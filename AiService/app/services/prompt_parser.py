"""
prompt_parser.py
Advanced Universal Natural Language Prompt Parser for Hospital Duty Roster Generation.
Handles arbitrary prompt formats, custom shift timings, employee codes/names/roles,
flexible time ranges, rotation sequences, exact week-offs, and transition rules.
"""

import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
from app.models.roster_schema import EmployeeInput, ShiftInput, RosterRulesInput, PinnedShift
from app.services.ollama_client import extract_constraints_with_ollama

DAYS_OF_WEEK = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

WORD_TO_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
}

def parse_int_or_word(s: str) -> Optional[int]:
    if not s:
        return None
    s = s.strip().lower()
    if s.isdigit():
        return int(s)
    return WORD_TO_NUM.get(s)

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

def is_employee_explicitly_mentioned(emp: EmployeeInput, prompt_text: str) -> bool:
    """Verifies if an employee's exact name or distinct tokens are present in prompt text."""
    p_lower = prompt_text.lower()
    # Check full name
    name_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', emp.name.lower()).strip()
    if name_clean and name_clean in p_lower:
        return True
    
    # Check individual significant name tokens (length >= 4 and not generic words)
    generic_words = {"shift", "duty", "nurse", "staff", "first", "second", "third", "night", "morning", "evening", "week", "days", "leave"}
    for token in name_clean.split():
        if len(token) >= 4 and token not in generic_words:
            if re.search(rf'\b{re.escape(token)}\b', p_lower):
                return True
                
    # Check employee ID
    if re.search(rf'\b(?:emp|employee|code|#)\s*{emp.id}\b', p_lower):
        return True
        
    return False

def parse_admin_prompt(
    prompt_text: str,
    employees: List[EmployeeInput],
    shifts: List[ShiftInput],
    date_list: List[str],
    base_rules: RosterRulesInput
) -> Tuple[RosterRulesInput, List[ShiftInput], List[str]]:
    """
    Parses natural language prompts using Local Ollama LLM + universal deterministic NLP:
    - Extracts custom time ranges and matches/creates shifts
    - Assigns specific shifts or times to explicitly mentioned employees
    - Interprets shift rotations (e.g. 2 staff on night rotation, 3 days each)
    - Interprets night-to-day transitions
    - Adjusts minimum and maximum staff coverage per shift
    - Enforces exact week-off quotas and default fill shifts
    """
    if not prompt_text or not prompt_text.strip():
        return base_rules, shifts, []

    text = prompt_text.strip()
    logs: List[str] = []
    
    rules = base_rules.model_copy(deep=True)
    pinned = list(rules.pinned_shifts)
    shift_pool = list(shifts)

    # ── Helper to Match or Dynamically Create Shift ─────────────────────────
    def find_or_create_shift(query: str, start_time: Optional[str] = None, end_time: Optional[str] = None) -> Optional[ShiftInput]:
        if not query:
            return None
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
            
            # Create dynamic custom shift
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

        return None

    # ── 1. Index Employees ───────────────────────────────────────────────────
    emp_by_id: Dict[int, EmployeeInput] = {e.id: e for e in employees}
    emp_lookup: Dict[str, EmployeeInput] = {}
    role_lookup: Dict[str, List[EmployeeInput]] = {}

    for e in employees:
        emp_lookup[str(e.id)] = e
        emp_lookup[e.name.lower().strip()] = e
        clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', e.name.lower())
        for token in clean_name.split():
            if len(token) > 2 and token not in emp_lookup:
                emp_lookup[token] = e
        if e.role_name:
            r_key = e.role_name.lower().strip()
            role_lookup.setdefault(r_key, []).append(e)

    # ── 2. Attempt Local Ollama LLM Extraction ────────────────────────────────
    emp_names = [e.name for e in employees]
    shift_names = [f"{s.shift_name} ({s.shift_code})" for s in shifts]
    
    ollama_res = extract_constraints_with_ollama(
        prompt_text=text,
        employee_names=emp_names,
        shift_names=shift_names,
        date_range=date_list
    )

    if ollama_res and isinstance(ollama_res, dict):
        logs.append("[Ollama AI] Interpreted prompt structure with local LLM (qwen2.5-coder:1.5b).")
        
        # 1. Shift coverage from Ollama (supports dict with min/max or flat numbers)
        cov_dict = ollama_res.get("shift_coverage") or ollama_res.get("shift_minimum_coverage") or {}
        for s_name, cov_val in cov_dict.items():
            matched_s = find_or_create_shift(s_name)
            if not matched_s:
                continue
            if isinstance(cov_val, dict):
                if "min" in cov_val and isinstance(cov_val["min"], int):
                    rules.min_staff_per_shift[matched_s.shift_code] = cov_val["min"]
                    logs.append(f"Prompt rule (Ollama): Set minimum coverage for '{matched_s.shift_name}' to {cov_val['min']} staff.")
                if "max" in cov_val and isinstance(cov_val["max"], int):
                    rules.max_staff_per_shift[matched_s.shift_code] = cov_val["max"]
                    logs.append(f"Prompt rule (Ollama): Set maximum coverage for '{matched_s.shift_name}' to {cov_val['max']} staff.")
            elif isinstance(cov_val, int):
                rules.min_staff_per_shift[matched_s.shift_code] = cov_val
                logs.append(f"Prompt rule (Ollama): Set minimum coverage for '{matched_s.shift_name}' to {cov_val} staff.")

        # 2. Rotation rules from Ollama
        rot_rule = ollama_res.get("rotation_rule")
        if rot_rule and isinstance(rot_rule, dict):
            tot_n = rot_rule.get("total_staff_count") or 2
            b_days = rot_rule.get("block_days") or 3
            rules.total_night_employees = int(tot_n)
            rules.night_rotation_block_days = int(b_days)
            rules.min_staff_per_shift['N'] = 1
            rules.max_staff_per_shift['N'] = 1
            if rot_rule.get("transition_to_day") is True:
                rules.require_off_after_night_shift = False
            logs.append(f"Prompt rule (Ollama): Night shift rotation set to {tot_n} staff ({b_days}-day consecutive blocks).")

        # Flat fields from Ollama
        if ollama_res.get("total_night_staff") is not None:
            rules.total_night_employees = int(ollama_res["total_night_staff"])
        if ollama_res.get("night_rotation_block_days") is not None:
            rules.night_rotation_block_days = int(ollama_res["night_rotation_block_days"])

        # Night to day rotation from Ollama
        if ollama_res.get("night_to_day_rotation") is True:
            rules.require_off_after_night_shift = False
            logs.append("Prompt rule (Ollama): Night shift staff transition seamlessly to Day/Morning shift upon ending rotation.")

        # Exact weekly offs from Ollama
        if ollama_res.get("exact_weekly_offs") is not None:
            rules.weekly_offs_per_employee = int(ollama_res["exact_weekly_offs"])
            rules.exact_weekly_offs = True
            logs.append(f"Prompt rule (Ollama): Enforced exactly {rules.weekly_offs_per_employee} week-off per employee for the period.")

        # Default fill shift from Ollama
        if ollama_res.get("default_fill_shift"):
            matched_fill = find_or_create_shift(str(ollama_res["default_fill_shift"]))
            if matched_fill:
                rules.default_fill_shift = matched_fill.shift_code
                logs.append(f"Prompt rule (Ollama): Default fill shift set to '{matched_fill.shift_name}' ({matched_fill.shift_code}).")

        # Max consecutive days from Ollama
        if ollama_res.get("max_consecutive_working_days"):
            rules.max_consecutive_working_days = int(ollama_res["max_consecutive_working_days"])

        # Min rest hours from Ollama
        if ollama_res.get("min_rest_hours"):
            rules.min_rest_hours_between_shifts = int(ollama_res["min_rest_hours"])

        # Named employee assignments from Ollama (Strictly verify that name is actually in prompt)
        emp_items = ollama_res.get("named_employee_assignments") or ollama_res.get("employee_assignments") or []
        for item in emp_items:
            e_name = str(item.get("name_or_role") or item.get("employee_name", "")).lower().strip()
            matched_emp = None
            for token, emp_obj in emp_lookup.items():
                if token in e_name or e_name in token:
                    matched_emp = emp_obj
                    break
            
            if matched_emp and is_employee_explicitly_mentioned(matched_emp, text):
                is_off = bool(item.get("is_week_off") or "off" in str(item.get("shift_or_timing", "")).lower())
                shift_desc = str(item.get("shift_or_timing") or item.get("shift_code_or_timing", "")).lower()
                target_dows = [DAYS_OF_WEEK[dow.lower()] for dow in (item.get("days_of_week") or []) if dow.lower() in DAYS_OF_WEEK]
                
                if is_off:
                    for d_str in date_list:
                        dt = datetime.strptime(d_str, "%Y-%m-%d")
                        if not target_dows or dt.weekday() in target_dows:
                            pinned.append(PinnedShift(employee_id=matched_emp.id, date=d_str, is_week_off=True))
                    logs.append(f"Prompt rule (Ollama): Assigned Week-Off to {matched_emp.name}.")
                elif shift_desc:
                    matched_s = find_or_create_shift(shift_desc)
                    if matched_s:
                        for d_str in date_list:
                            dt = datetime.strptime(d_str, "%Y-%m-%d")
                            if not target_dows or dt.weekday() in target_dows:
                                pinned.append(PinnedShift(
                                    employee_id=matched_emp.id,
                                    date=d_str,
                                    shift_id=matched_s.id,
                                    shift_code=matched_s.shift_code
                                ))
                        logs.append(f"Prompt rule (Ollama): Assigned {matched_emp.name} to {matched_s.shift_name}.")

        # User-facing interpretations from Ollama
        for interp in (ollama_res.get("interpretations") or []):
            if isinstance(interp, str) and interp not in logs:
                logs.append(f"[AI]: {interp}")

    # ── 3. High-Precision Deterministic NLP Rules ───────────────────────────
    # A. Parse Night Shift Rotation (e.g. "two employee in night shift ... first 3 days, another in next 3 days")
    m_rot = re.search(
        r'(\d+|one|two|three|four)\s*(?:employees?|staff|people|nurses)?\s*(?:should be in|in|for|on)?\s*night\s*(?:shift)?.*?'
        r'(?:first|one\s*in\s*first)\s*(\d+|one|two|three|four)\s*days?.*?'
        r'(?:next|another\s*in\s*next)\s*(\d+|one|two|three|four)\s*days?',
        text, re.IGNORECASE
    )
    if m_rot:
        tot_n = parse_int_or_word(m_rot.group(1)) or 2
        b1 = parse_int_or_word(m_rot.group(2)) or 3
        b2 = parse_int_or_word(m_rot.group(3)) or 3
        rules.total_night_employees = tot_n
        rules.night_rotation_block_days = b1
        rules.min_staff_per_shift['N'] = 1
        rules.max_staff_per_shift['N'] = 1
        rules.require_off_after_night_shift = False
        logs.append(f"Prompt rule: Night shift rotation set to {tot_n} staff ({b1}-day block rotation: 1 staff for first {b1} days, 1 for next {b2} days).")

    # B. Parse Exact Weekly Offs (e.g. "Only one week off for each employee in this week")
    m_off = re.search(r'(?:only\s*)?(\d+|one|two)\s*week[\s\-]offs?\s*(?:for\s*each|per)', text, re.IGNORECASE)
    if m_off:
        off_cnt = parse_int_or_word(m_off.group(1)) or 1
        rules.weekly_offs_per_employee = off_cnt
        rules.exact_weekly_offs = True
        logs.append(f"Prompt rule: Enforced exactly {off_cnt} week-off per employee for the period.")

    # C. Parse Fill Others Shift (e.g. "fill others with morning shift")
    m_fill = re.search(r'fill\s*others\s*with\s*([a-zA-Z\s]+?)(?:shift)?(?=[,\.]|$|\bif\b|\band\b)', text, re.IGNORECASE)
    if m_fill:
        fill_desc = m_fill.group(1).strip()
        matched_fill = find_or_create_shift(fill_desc)
        if matched_fill:
            rules.default_fill_shift = matched_fill.shift_code
            logs.append(f"Prompt rule: Default fill shift set to '{matched_fill.shift_name}' ({matched_fill.shift_code}).")

    # D. Parse Night-to-Day Transition
    if any(k in text.lower() for k in [
        "ends night shift", "continue day shift", "work day shift", "then day shift",
        "night to day", "transition to day", "then morning shift"
    ]):
        rules.require_off_after_night_shift = False
        logs.append("Prompt rule: Staff transition directly into Day/Morning shift upon completing night shift rotation.")

    # E. Parse Global Shift Minimums (e.g. "min 2 morning", "1 in night", "morning: 2")
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
                if target_shift.lower() in DAYS_OF_WEEK or target_shift.lower() in ["days", "day", "hours", "consecutive", "weeks", "employee", "employees", "staff"]:
                    continue
                matched_s = find_or_create_shift(target_shift)
                if matched_s:
                    rules.min_staff_per_shift[matched_s.shift_code] = cnt

    # F. Parse Fatigue and Rest limits
    m_consec = re.search(r'max(?:imum)?\s*(\d+)\s*(?:consecutive|work|working)\s*days?', text, re.IGNORECASE)
    if m_consec:
        rules.max_consecutive_working_days = int(m_consec.group(1))
        logs.append(f"Prompt rule: Maximum consecutive working days set to {rules.max_consecutive_working_days}.")

    m_rest = re.search(r'(\d+)\s*(?:hours?|hrs?)\s*(?:rest|break|gap)', text, re.IGNORECASE)
    if m_rest:
        rules.min_rest_hours_between_shifts = int(m_rest.group(1))

    # G. Parse Named Employee Directives (Only if explicitly in prompt)
    clauses = re.split(r'[,;\.\n]|\band\b|\balso\b|\bthen\b', text, flags=re.IGNORECASE)
    for raw_clause in clauses:
        clause = raw_clause.strip()
        if not clause:
            continue
        c_lower = clause.lower()

        # Identify target employees in clause
        target_emps: List[EmployeeInput] = []
        for emp in employees:
            if is_employee_explicitly_mentioned(emp, clause):
                target_emps.append(emp)

        # Check by Role
        if not target_emps:
            for r_name, r_emps in role_lookup.items():
                if r_name in c_lower or (r_name + 's') in c_lower:
                    target_emps.extend([e for e in r_emps if e not in target_emps])

        if not target_emps:
            continue

        # Check Day-Off / Leave in clause
        if any(w in c_lower for w in ["off", "leave", "holiday", "rest", "vacation"]):
            matched_dow = list(dict.fromkeys([
                dow_idx for dow_name, dow_idx in DAYS_OF_WEEK.items()
                if re.search(rf'\b{re.escape(dow_name)}\b', c_lower)
            ]))
            for emp in target_emps:
                if matched_dow:
                    for d_str in date_list:
                        dt = datetime.strptime(d_str, "%Y-%m-%d")
                        if dt.weekday() in matched_dow:
                            pinned.append(PinnedShift(employee_id=emp.id, date=d_str, is_week_off=True))
                    dow_labels = ", ".join([DAY_NAMES[idx] for idx in matched_dow])
                    logs.append(f"Prompt rule: Assigned Week-Off to {emp.name} on {dow_labels}.")
                elif "all days" in c_lower or "whole week" in c_lower:
                    for d_str in date_list:
                        pinned.append(PinnedShift(employee_id=emp.id, date=d_str, is_week_off=True))
                    logs.append(f"Prompt rule: Pinned Week-Off for {emp.name} across full period.")

        # Check Custom Timings or Shift assignment in clause
        time_range_match = re.search(r'(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)', c_lower)
        target_shift_obj = None
        if time_range_match:
            t1 = normalize_time_str(time_range_match.group(1))
            t2 = normalize_time_str(time_range_match.group(2))
            if t1 and t2:
                target_shift_obj = find_or_create_shift(f"{t1[:5]}-{t2[:5]}", start_time=t1, end_time=t2)

        if not target_shift_obj:
            for s in shift_pool:
                s_name = (s.shift_name or "").lower()
                s_code = (s.shift_code or "").lower()
                if (s_code and re.search(rf'\b{re.escape(s_code)}\b', c_lower)) or (s_name and re.search(rf'\b{re.escape(s_name)}\b', c_lower)):
                    target_shift_obj = s
                    break

        if target_shift_obj and not any(neg in c_lower for neg in ["no", "not", "avoid", "never"]):
            for emp in target_emps:
                m_days = re.search(r'first\s*(\d+|one|two|three|four)\s*days?', c_lower)
                if m_days:
                    num_d = min(parse_int_or_word(m_days.group(1)) or 3, len(date_list))
                    for i in range(num_d):
                        pinned.append(PinnedShift(
                            employee_id=emp.id,
                            date=date_list[i],
                            shift_id=target_shift_obj.id,
                            shift_code=target_shift_obj.shift_code
                        ))
                    logs.append(f"Prompt rule: Assigned {emp.name} to {target_shift_obj.shift_name} for first {num_d} days.")
                    
                    if any(w in text.lower() for w in ["then day", "then morning", "continue day", "work day"]):
                        day_s = find_or_create_shift("day") or find_or_create_shift("morning")
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
                    for d_str in date_list:
                        pinned.append(PinnedShift(
                            employee_id=emp.id,
                            date=d_str,
                            shift_id=target_shift_obj.id,
                            shift_code=target_shift_obj.shift_code
                        ))
                    logs.append(f"Prompt rule: Assigned {emp.name} to {target_shift_obj.shift_name}.")

    # Deduplicate logs
    seen = set()
    clean_logs = []
    for l in logs:
        if l not in seen:
            seen.add(l)
            clean_logs.append(l)

    rules.pinned_shifts = pinned
    return rules, shift_pool, clean_logs
