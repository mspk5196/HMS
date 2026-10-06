"""
prompt_parser.py
Advanced Universal Natural Language Prompt Parser for Hospital Duty Roster Generation.
Handles arbitrary prompt formats, custom shift timings, employee codes/names/roles,
flexible time ranges, rotation sequences, and transition rules.
"""

import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
from app.models.roster_schema import EmployeeInput, ShiftInput, RosterRulesInput, PinnedShift

DAYS_OF_WEEK = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6
}

def normalize_time_str(t_str: str) -> Optional[str]:
    """Converts various time expressions ('8am', '08:30', '8.30pm', '20:00') into 'HH:MM:SS'."""
    t_str = t_str.strip().lower()
    # 24h format with colon
    m24 = re.match(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$', t_str)
    if m24:
        h, m = int(m24.group(1)), int(m24.group(2))
        return f"{h:02d}:{m:02d}:00"
    
    # 12h format with am/pm
    m12 = re.match(r'^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)$', t_str)
    if m12:
        h = int(m12.group(1))
        m = int(m12.group(2) or 0)
        mer = m12.group(3)
        if mer == "pm" and h < 12:
            h += 12
        elif mer == "am" and h == 12:
            h = 0
        return f"{h:02d}:{m:02d}:00"
    
    return None

def parse_admin_prompt(
    prompt_text: str,
    employees: List[EmployeeInput],
    shifts: List[ShiftInput],
    date_list: List[str],
    base_rules: RosterRulesInput
) -> Tuple[RosterRulesInput, List[ShiftInput], List[str]]:
    """
    Universally parses natural language prompts of any arbitrary phrasing:
    - Extracts custom time ranges and matches/creates shifts
    - Assigns specific shifts or times to employees (by ID, full name, first name, role)
    - Interprets shift rotations (e.g. night for X days then day shift)
    - Interprets shift transitions (e.g. continuing day shift after ending night block)
    - Adjusts minimum staff coverage per shift
    - Adjusts fatigue/consecutive day limits
    - Handles week-off preferences (e.g. Sunday off)
    Returns: (enhanced_rules, updated_shifts, log_messages)
    """
    if not prompt_text or not prompt_text.strip():
        return base_rules, shifts, []

    text = prompt_text.strip()
    logs: List[str] = []
    
    rules = base_rules.model_copy(deep=True)
    pinned = list(rules.pinned_shifts)
    shift_pool = list(shifts)

    # ── 1. Index Employees ───────────────────────────────────────────────────
    emp_by_id: Dict[int, EmployeeInput] = {e.id: e for e in employees}
    emp_lookup: Dict[str, EmployeeInput] = {}
    role_lookup: Dict[str, List[EmployeeInput]] = {}

    for e in employees:
        # ID / Code matches
        emp_lookup[str(e.id)] = e
        # Full Name
        emp_lookup[e.name.lower().strip()] = e
        # Name tokens (e.g. 'Aiswarya', 'Priya', 'Dr. Smith')
        clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', e.name.lower())
        for token in clean_name.split():
            if len(token) > 2 and token not in emp_lookup:
                emp_lookup[token] = e
        # Role indexing
        if e.role_name:
            r_key = e.role_name.lower().strip()
            role_lookup.setdefault(r_key, []).append(e)

    # ── 2. Helper to Match or Dynamically Create Shift ─────────────────────────
    def find_or_create_shift(query: str, start_time: Optional[str] = None, end_time: Optional[str] = None) -> ShiftInput:
        q = query.lower().strip()
        # Check existing shifts by code or name
        for s in shift_pool:
            if s.shift_code and s.shift_code.lower() == q:
                return s
            if s.shift_name and (q in s.shift_name.lower() or s.shift_name.lower() in q):
                return s
        
        # Check standard keywords
        for s in shift_pool:
            s_name = (s.shift_name or "").lower()
            s_code = (s.shift_code or "").lower()
            if "night" in q and ("night" in s_name or s_code == "n" or s.is_night_shift):
                return s
            if ("morning" in q or "day" in q) and ("morning" in s_name or "day" in s_name or s_code in ("m", "d") and not s.is_night_shift):
                return s
            if "evening" in q and ("evening" in s_name or s_code == "e"):
                return s
            if "general" in q and ("general" in s_name or s_code == "g"):
                return s

        # If timing is provided, match by time or create virtual shift
        if start_time and end_time:
            for s in shift_pool:
                if s.start_time and s.start_time.startswith(start_time[:5]) and s.end_time and s.end_time.startswith(end_time[:5]):
                    return s
            
            # Create a dynamic custom shift
            new_id = max([s.id for s in shift_pool] + [0]) + 1
            is_night = start_time >= "18:00" or start_time < "06:00" or end_time < start_time
            code = f"C{new_id}"
            new_s = ShiftInput(
                id=new_id,
                shift_code=code,
                shift_name=f"Custom ({start_time[:5]}-{end_time[:5]})",
                start_time=start_time,
                end_time=end_time,
                is_night_shift=is_night,
                is_active=True
            )
            shift_pool.append(new_s)
            logs.append(f"Prompt rule: Created custom shift slot '{new_s.shift_name}' ({new_s.start_time} - {new_s.end_time}).")
            return new_s

        # Fallback to first active shift
        return shift_pool[0] if shift_pool else None

    # ── 3. Parse Global Shift Minimums from Prompt ────────────────────────────
    # Regex covers: "min 3 morning", "3 in night", "morning: 2", "need 4 nurses for evening", "2 day, 1 night"
    cov_regexes = [
        r'(\d+)\s*(?:staff|nurses|members|people|slots)?\s*(?:in|for|on|during)?\s*([a-zA-Z0-9_\-\s]+?)(?=[,;\.\n]|\band\b|$)',
        r'([a-zA-Z0-9_\-]+)\s*[:=]\s*(\d+)',
        r'min(?:imum)?\s*(\d+)\s*(?:in|for|on)?\s*([a-zA-Z0-9_\-]+)'
    ]
    
    for r_pat in cov_regexes:
        for m in re.finditer(r_pat, text, re.IGNORECASE):
            g1, g2 = m.group(1).strip(), m.group(2).strip()
            cnt_str, target_shift = (g1, g2) if g1.isdigit() else (g2, g1)
            if cnt_str.isdigit() and not target_shift.isdigit():
                cnt = int(cnt_str)
                # Ignore if target_shift looks like a day of week or employee name
                if target_shift.lower() in DAYS_OF_WEEK or target_shift.lower() in ["days", "day", "hours", "consecutive", "weeks"]:
                    continue
                matched_s = find_or_create_shift(target_shift)
                if matched_s:
                    rules.min_staff_per_shift[matched_s.shift_code] = cnt
                    logs.append(f"Prompt rule: Set minimum coverage for '{matched_s.shift_name}' ({matched_s.shift_code}) to {cnt} staff.")

    # ── 4. Parse Global Fatigue, Rest & Night-to-Day Transition ───────────────
    # Max Consecutive Days
    m_consec = re.search(r'max(?:imum)?\s*(\d+)\s*(?:consecutive|work|working)\s*days?', text, re.IGNORECASE)
    if m_consec:
        rules.max_consecutive_working_days = int(m_consec.group(1))
        logs.append(f"Prompt rule: Maximum consecutive working days set to {rules.max_consecutive_working_days}.")

    # Min Rest Hours
    m_rest = re.search(r'(\d+)\s*(?:hours?|hrs?)\s*(?:rest|break|gap)', text, re.IGNORECASE)
    if m_rest:
        rules.min_rest_hours_between_shifts = int(m_rest.group(1))
        logs.append(f"Prompt rule: Minimum rest between shifts set to {rules.min_rest_hours_between_shifts} hours.")

    # Night Shift Limits
    m_night_max = re.search(r'max(?:imum)?\s*(\d+)\s*night', text, re.IGNORECASE)
    if m_night_max:
        rules.max_night_shifts_per_week = int(m_night_max.group(1))
        logs.append(f"Prompt rule: Maximum night shifts per week set to {rules.max_night_shifts_per_week}.")

    # Night-to-Day continuation (seamless rotation)
    if any(k in text.lower() for k in [
        "continue day shift", "night shift for that week", "ends night shift",
        "end of night", "night to day", "then day shift", "continue day", "transition to day"
    ]):
        rules.require_off_after_night_shift = False
        logs.append("Prompt rule: Staff finishing Night shift rotation transition directly into Day shift.")

    # ── 5. Parse Employee / Role Specific Directives ──────────────────────────
    # Split text into logical instructions
    clauses = re.split(r'[,;\.\n]|\band\b|\balso\b|\bthen\b', text, flags=re.IGNORECASE)
    
    for raw_clause in clauses:
        clause = raw_clause.strip()
        if not clause:
            continue
        c_lower = clause.lower()

        # Identify Target Employees in this clause
        target_emps: List[EmployeeInput] = []
        
        # Check by ID / Code (e.g. 'emp 227', '#227', 'employee 101')
        id_matches = re.findall(r'(?:emp|employee|code|#)\s*(\d+)', c_lower)
        for emp_id_str in id_matches:
            eid = int(emp_id_str)
            if eid in emp_by_id and emp_by_id[eid] not in target_emps:
                target_emps.append(emp_by_id[eid])

        # Check by Name tokens
        if not target_emps:
            for token, emp_obj in emp_lookup.items():
                if re.search(rf'\b{re.escape(token)}\b', c_lower):
                    if emp_obj not in target_emps:
                        target_emps.append(emp_obj)

        # Check by Role (e.g. 'all staff nurses', 'doctors')
        if not target_emps:
            for r_name, r_emps in role_lookup.items():
                if r_name in c_lower or (r_name + 's') in c_lower:
                    target_emps.extend([e for e in r_emps if e not in target_emps])

        if not target_emps:
            continue

        # Extract Day-Off / Leave requests in this clause
        if any(w in c_lower for w in ["off", "leave", "holiday", "rest", "vacation"]):
            matched_dow = []
            for dow_name, dow_idx in DAYS_OF_WEEK.items():
                if re.search(rf'\b{re.escape(dow_name)}\b', c_lower):
                    matched_dow.append(dow_idx)
            
            for emp in target_emps:
                if matched_dow:
                    for d_str in date_list:
                        dt = datetime.strptime(d_str, "%Y-%m-%d")
                        if dt.weekday() in matched_dow:
                            pinned.append(PinnedShift(employee_id=emp.id, date=d_str, is_week_off=True))
                    dow_labels = ", ".join([list(DAYS_OF_WEEK.keys())[idx*2].capitalize() for idx in matched_dow])
                    logs.append(f"Prompt rule: Assigned Week-Off to {emp.name} on {dow_labels}.")
                elif "all days" in c_lower or "whole week" in c_lower:
                    for d_str in date_list:
                        pinned.append(PinnedShift(employee_id=emp.id, date=d_str, is_week_off=True))
                    logs.append(f"Prompt rule: Pinned Week-Off for {emp.name} across the full period.")

        # Extract Custom Timings in clause (e.g. '08:30 to 18:30', '8am-5pm', '20:00 - 08:00')
        time_range_match = re.search(r'(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)', c_lower)
        target_shift_obj = None
        
        if time_range_match:
            t1 = normalize_time_str(time_range_match.group(1))
            t2 = normalize_time_str(time_range_match.group(2))
            if t1 and t2:
                target_shift_obj = find_or_create_shift(f"{t1[:5]}-{t2[:5]}", start_time=t1, end_time=t2)
        
        if not target_shift_obj:
            # Check by Shift keyword (morning, evening, night, general, day, shift 1, shift a, etc.)
            for s in shift_pool:
                s_name = (s.shift_name or "").lower()
                s_code = (s.shift_code or "").lower()
                if (s_code and re.search(rf'\b{re.escape(s_code)}\b', c_lower)) or (s_name and re.search(rf'\b{re.escape(s_name)}\b', c_lower)):
                    target_shift_obj = s
                    break
            
            if not target_shift_obj:
                if "night" in c_lower:
                    target_shift_obj = find_or_create_shift("night")
                elif "morning" in c_lower or "day" in c_lower:
                    target_shift_obj = find_or_create_shift("day")
                elif "evening" in c_lower:
                    target_shift_obj = find_or_create_shift("evening")
                elif "general" in c_lower:
                    target_shift_obj = find_or_create_shift("general")

        # Apply Shift Assignment if found
        if target_shift_obj and not any(neg in c_lower for neg in ["no", "not", "avoid", "never"]):
            for emp in target_emps:
                # Check for "first X days" rotation pattern
                m_days = re.search(r'first\s*(\d+)\s*days?', c_lower)
                if m_days:
                    num_d = min(int(m_days.group(1)), len(date_list))
                    for i in range(num_d):
                        pinned.append(PinnedShift(
                            employee_id=emp.id,
                            date=date_list[i],
                            shift_id=target_shift_obj.id,
                            shift_code=target_shift_obj.shift_code
                        ))
                    logs.append(f"Prompt rule: Assigned {emp.name} to {target_shift_obj.shift_name} for first {num_d} days.")
                    
                    # Follow-up shift transition in prompt (e.g. "then day shift")
                    if any(w in text.lower() for w in ["then day", "then morning", "continue day"]):
                        day_s = find_or_create_shift("day")
                        if day_s:
                            for i in range(num_d, len(date_list)):
                                pinned.append(PinnedShift(
                                    employee_id=emp.id,
                                    date=date_list[i],
                                    shift_id=day_s.id,
                                    shift_code=day_s.shift_code
                                ))
                            logs.append(f"Prompt rule: Transitioned {emp.name} to {day_s.shift_name} for remaining days.")
                else:
                    # Specific days of week mentioned for shift?
                    matched_shift_dow = [dow_idx for dow_name, dow_idx in DAYS_OF_WEEK.items() if re.search(rf'\b{re.escape(dow_name)}\b', c_lower)]
                    if matched_shift_dow:
                        for d_str in date_list:
                            dt = datetime.strptime(d_str, "%Y-%m-%d")
                            if dt.weekday() in matched_shift_dow:
                                pinned.append(PinnedShift(
                                    employee_id=emp.id,
                                    date=d_str,
                                    shift_id=target_shift_obj.id,
                                    shift_code=target_shift_obj.shift_code
                                ))
                        logs.append(f"Prompt rule: Assigned {emp.name} to {target_shift_obj.shift_name} on specified days.")
                    else:
                        # Full period preferred assignment
                        for d_str in date_list:
                            pinned.append(PinnedShift(
                                employee_id=emp.id,
                                date=d_str,
                                shift_id=target_shift_obj.id,
                                shift_code=target_shift_obj.shift_code
                            ))
                        logs.append(f"Prompt rule: Assigned {emp.name} to {target_shift_obj.shift_name}.")

    rules.pinned_shifts = pinned
    return rules, shift_pool, logs
