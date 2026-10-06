"""
prompt_parser.py
Natural Language Prompt Parser for Hospital Duty Roster Generation.
Parses natural language prompts from hospital admins into structured CP-SAT solver constraints.
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Tuple
from app.models.roster_schema import EmployeeInput, ShiftInput, RosterRulesInput, PinnedShift

def parse_admin_prompt(
    prompt_text: str,
    employees: List[EmployeeInput],
    shifts: List[ShiftInput],
    date_list: List[str],
    base_rules: RosterRulesInput
) -> Tuple[RosterRulesInput, List[str]]:
    """
    Parses a natural language prompt and enhances RosterRulesInput with:
    - Min staff per shift adjustments
    - Individual employee pinned shifts / preferred shifts
    - Custom employee timings / shifts
    - Night-to-Day transition preferences
    - Specific day-off requests (e.g., Sunday off)
    Returns (enhanced_rules, log_messages)
    """
    if not prompt_text or not prompt_text.strip():
        return base_rules, []

    text = prompt_text.strip().lower()
    logs: List[str] = []
    
    # Lookup dictionaries
    emp_lookup: Dict[str, EmployeeInput] = {}
    for e in employees:
        emp_lookup[str(e.id)] = e
        emp_lookup[e.name.lower()] = e
        parts = e.name.lower().split()
        for p in parts:
            if len(p) > 2 and p not in emp_lookup:
                emp_lookup[p] = e

    shift_lookup: Dict[str, ShiftInput] = {}
    for s in shifts:
        s_code = (s.shift_code or "").lower()
        s_name = (s.shift_name or "").lower()
        if s_code:
            shift_lookup[s_code] = s
        if s_name:
            shift_lookup[s_name] = s
        if "morning" in s_name or s_code == "m":
            shift_lookup["morning"] = s
            shift_lookup["m"] = s
        if "evening" in s_name or s_code == "e":
            shift_lookup["evening"] = s
            shift_lookup["e"] = s
        if "night" in s_name or s_code == "n":
            shift_lookup["night"] = s
            shift_lookup["n"] = s
        if "general" in s_name or s_code == "g":
            shift_lookup["general"] = s
            shift_lookup["g"] = s
        if "day" in s_name or s_code == "d":
            shift_lookup["day"] = s
            shift_lookup["d"] = s

    rules = base_rules.model_copy(deep=True)
    pinned = list(rules.pinned_shifts)

    # ── 1. Shift Minimum Staff Coverage Extraction ─────────────────────────────
    cov_patterns = [
        (r'(\d+)\s*(?:staff|nurses|members|people)?\s*(?:in|for|on)?\s*(morning|evening|night|general|day)', 1, 2),
        (r'(morning|evening|night|general|day)\s*[:=]?\s*(\d+)', 2, 1),
        (r'min(?:imum)?\s*(\d+)\s*(?:in|for|on)?\s*(morning|evening|night|general|day)', 1, 2),
    ]
    for pat, count_idx, shift_idx in cov_patterns:
        for m in re.finditer(pat, text):
            cnt = int(m.group(count_idx))
            s_name = m.group(shift_idx)
            if s_name in shift_lookup:
                s_obj = shift_lookup[s_name]
                rules.min_staff_per_shift[s_obj.shift_code] = cnt
                logs.append(f"Prompt rule: Set {s_obj.shift_name} ({s_obj.shift_code}) minimum staff coverage to {cnt}.")

    # ── 2. Consecutive Days & Fatigue Limits ──────────────────────────────────
    m_consec = re.search(r'max(?:imum)?\s*(\d+)\s*(?:consecutive|work|working)\s*days?', text)
    if m_consec:
        max_d = int(m_consec.group(1))
        rules.max_consecutive_working_days = max_d
        logs.append(f"Prompt rule: Max consecutive working days set to {max_d}.")

    m_night_lim = re.search(r'(?:max|limit)\s*(?:night|nights)?\s*(?:shifts?)?\s*(?:to|is)?\s*(\d+)\s*night', text)
    if m_night_lim:
        n_lim = int(m_night_lim.group(1))
        rules.max_night_shifts_per_week = n_lim
        logs.append(f"Prompt rule: Max night shifts per week set to {n_lim}.")

    # ── 3. Night-to-Day Continuation Rule ─────────────────────────────────────
    if any(k in text for k in [
        "continue day shift", "night shift for that week", "ends night shift",
        "night to day", "then day shift", "continue day", "end of night shift"
    ]):
        rules.require_off_after_night_shift = False
        logs.append("Prompt rule: Staff finishing Night duty rotation transition to Day duty.")

    # ── 4. Specific Employee Shift Assignments & Timings ─────────────────────
    clauses = re.split(r'[,;\n]|\band\b|\balso\b', text)
    days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    for clause in clauses:
        c = clause.strip()
        if not c:
            continue

        matched_emp: EmployeeInput = None
        for name_key, emp_obj in emp_lookup.items():
            if re.search(rf'\b{re.escape(name_key)}\b', c):
                matched_emp = emp_obj
                break

        if not matched_emp:
            continue

        # Check for Week-Off / Off instruction for this employee
        if any(w in c for w in ["off", "leave", "holiday", "rest"]):
            for dow_idx, dow_name in enumerate(days_of_week):
                if dow_name in c:
                    for d_str in date_list:
                        dt = datetime.strptime(d_str, "%Y-%m-%d")
                        if dt.weekday() == dow_idx:
                            pinned.append(PinnedShift(employee_id=matched_emp.id, date=d_str, is_week_off=True))
                            logs.append(f"Prompt rule: Pinned Day-Off for {matched_emp.name} on {dow_name.capitalize()} ({d_str}).")

        # Check for Shift Assignment
        for s_key in ["morning", "evening", "night", "general", "day"]:
            if s_key in shift_lookup and re.search(rf'\b{re.escape(s_key)}\b', c) and not any(neg in c for neg in ["no", "not", "avoid", "never"]):
                s_obj = shift_lookup[s_key]

                m_days = re.search(r'first\s*(\d+)\s*days?', c)
                if m_days:
                    num_d = min(int(m_days.group(1)), len(date_list))
                    for i in range(num_d):
                        pinned.append(PinnedShift(
                            employee_id=matched_emp.id,
                            date=date_list[i],
                            shift_id=s_obj.id,
                            shift_code=s_obj.shift_code
                        ))
                    logs.append(f"Prompt rule: Assigned {matched_emp.name} to {s_obj.shift_name} for first {num_d} days.")

                    if "then day" in c or "then morning" in c:
                        day_shift = shift_lookup.get("day") or shift_lookup.get("morning")
                        if day_shift:
                            for i in range(num_d, len(date_list)):
                                pinned.append(PinnedShift(
                                    employee_id=matched_emp.id,
                                    date=date_list[i],
                                    shift_id=day_shift.id,
                                    shift_code=day_shift.shift_code
                                ))
                            logs.append(f"Prompt rule: Transitioned {matched_emp.name} to {day_shift.shift_name} for remaining days.")
                else:
                    # Specific days of week mentioned?
                    mentioned_days = [idx for idx, dname in enumerate(days_of_week) if dname in c]
                    if mentioned_days:
                        for d_str in date_list:
                            dt = datetime.strptime(d_str, "%Y-%m-%d")
                            if dt.weekday() in mentioned_days:
                                pinned.append(PinnedShift(
                                    employee_id=matched_emp.id,
                                    date=d_str,
                                    shift_id=s_obj.id,
                                    shift_code=s_obj.shift_code
                                ))
                        logs.append(f"Prompt rule: Assigned {matched_emp.name} to {s_obj.shift_name} on specified days.")
                    else:
                        # Full period assignment
                        for d_str in date_list:
                            pinned.append(PinnedShift(
                                employee_id=matched_emp.id,
                                date=d_str,
                                shift_id=s_obj.id,
                                shift_code=s_obj.shift_code
                            ))
                        logs.append(f"Prompt rule: Assigned {matched_emp.name} to {s_obj.shift_name}.")
                break

    rules.pinned_shifts = pinned
    return rules, logs
