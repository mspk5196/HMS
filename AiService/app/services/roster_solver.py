"""
roster_solver.py
High-performance Staff Duty Roster Scheduling Engine using Google OR-Tools CP-SAT.
Solves hospital scheduling with hard constraints (coverage, rest, leaves, fatigue, rotation)
and soft fairness optimization.
"""

import time
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from ortools.sat.python import cp_model
from app.models.roster_schema import (
    RosterSolveRequest,
    RosterSolveResponse,
    RosterAssignment,
    Violation,
)
from app.services.prompt_parser import parse_admin_prompt

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

def format_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

def generate_date_range(start_str: str, end_str: str) -> List[str]:
    start = parse_date(start_str)
    end = parse_date(end_str)
    delta = end - start
    return [format_date(start + timedelta(days=i)) for i in range(delta.days + 1)]

def solve_roster(req: RosterSolveRequest) -> RosterSolveResponse:
    start_time = time.time()
    
    dates = generate_date_range(req.start_date, req.end_date)
    num_days = len(dates)
    num_employees = len(req.employees)
    
    if num_employees == 0:
        return RosterSolveResponse(
            status="INFEASIBLE",
            solve_time_seconds=0.0,
            assignments=[],
            violations=[Violation(rule="NO_EMPLOYEES", severity="HARD", description="No employees provided for scheduling")],
            metrics={},
            message="No employees provided"
        )
    
    # Active shifts
    shifts = [s for s in req.shifts if s.is_active is not False]
    if not shifts:
        return RosterSolveResponse(
            status="INFEASIBLE",
            solve_time_seconds=0.0,
            assignments=[],
            violations=[Violation(rule="NO_SHIFTS", severity="HARD", description="No active shifts configured")],
            metrics={},
            message="No active shifts configured"
        )
    
    # Process Natural Language Prompt if provided
    prompt_logs: List[str] = []
    active_rules = req.rules
    if req.prompt and req.prompt.strip():
        active_rules, shifts, prompt_logs = parse_admin_prompt(
            req.prompt,
            req.employees,
            shifts,
            dates,
            req.rules
        )
    
    # Map lookups
    emp_by_id = {e.id: e for e in req.employees}
    shift_by_id = {s.id: s for s in shifts}
    shift_by_code = {s.shift_code: s for s in shifts}
    shift_ids = [s.id for s in shifts]
    
    # Identify shift types
    night_shift_ids = {s.id for s in shifts if s.is_night_shift or "night" in s.shift_name.lower() or s.shift_code == "N"}
    morning_shift_ids = {s.id for s in shifts if "morning" in s.shift_name.lower() or s.shift_code in ("M", "D") and not s.is_night_shift}
    evening_shift_ids = {s.id for s in shifts if "evening" in s.shift_name.lower() or s.shift_code == "E"}
    
    # Default fill shift ID
    fill_shift_id = None
    if active_rules.default_fill_shift and active_rules.default_fill_shift in shift_by_code:
        fill_shift_id = shift_by_code[active_rules.default_fill_shift].id
    elif morning_shift_ids:
        fill_shift_id = list(morning_shift_ids)[0]
    elif shift_ids:
        fill_shift_id = shift_ids[0]

    # Set of approved leaves: (emp_id, date_str)
    approved_leaves_set = {(l.employee_id, l.date) for l in active_rules.approved_leaves}
    
    # Map of pinned shifts: (emp_id, date_str) -> PinnedShift
    pinned_map = {(p.employee_id, p.date): p for p in active_rules.pinned_shifts}
    
    # History for consecutive working days continuity
    history_streak: Dict[int, int] = {}
    if req.history:
        for h in req.history:
            e_id = h.get("employee_id")
            streak = h.get("consecutive_worked_days", 0)
            if e_id and streak:
                history_streak[e_id] = min(streak, active_rules.max_consecutive_working_days)

    # ── CP-SAT Model Initialization ──────────────────────────────────────────
    model = cp_model.CpModel()
    objective_terms = []
    
    # Decision Variables:
    # x[e, d, s] == 1 if employee e works shift s on day d
    # w[e, d] == 1 if employee e has a Week-Off on day d
    x = {}
    w = {}
    
    for e in req.employees:
        for d_idx in range(num_days):
            w[(e.id, d_idx)] = model.NewBoolVar(f"w_e{e.id}_d{d_idx}")
            for s_id in shift_ids:
                x[(e.id, d_idx, s_id)] = model.NewBoolVar(f"x_e{e.id}_d{d_idx}_s{s_id}")

    # ── 1. Daily Mutex Constraint ────────────────────────────────────────────
    # Each employee has exactly 1 state per day: exactly one shift OR Week-Off OR Leave
    for e in req.employees:
        for d_idx, d_str in enumerate(dates):
            is_leave = (e.id, d_str) in approved_leaves_set
            if is_leave:
                model.Add(w[(e.id, d_idx)] == 0)
                for s_id in shift_ids:
                    model.Add(x[(e.id, d_idx, s_id)] == 0)
            else:
                model.Add(sum(x[(e.id, d_idx, s_id)] for s_id in shift_ids) + w[(e.id, d_idx)] == 1)

    # ── 2. Pinned Shifts Constraint ──────────────────────────────────────────
    for (e_id, d_str), pin in pinned_map.items():
        if e_id not in emp_by_id or d_str not in dates:
            continue
        d_idx = dates.index(d_str)
        if pin.is_week_off:
            model.Add(w[(e_id, d_idx)] == 1)
            for s_id in shift_ids:
                model.Add(x[(e_id, d_idx, s_id)] == 0)
        else:
            target_sid = None
            if pin.shift_id and pin.shift_id in shift_by_id:
                target_sid = pin.shift_id
            elif pin.shift_code and pin.shift_code in shift_by_code:
                target_sid = shift_by_code[pin.shift_code].id
            
            if target_sid is not None:
                for s_id in shift_ids:
                    if s_id != target_sid:
                        model.Add(x[(e_id, d_idx, s_id)] == 0)
                model.Add(w[(e_id, d_idx)] == 0)
                objective_terms.append(x[(e_id, d_idx, target_sid)] * -500)

    # ── 3. Maximum Consecutive Working Days ──────────────────────────────────
    max_streak = active_rules.max_consecutive_working_days or 6
    window_size = max_streak + 1
    
    for e in req.employees:
        prior_streak = history_streak.get(e.id, 0)
        if prior_streak > 0 and prior_streak < max_streak:
            remaining_allowed = max_streak - prior_streak
            if remaining_allowed < num_days:
                days_off = [w[(e.id, k)] for k in range(remaining_allowed + 1)]
                for k in range(remaining_allowed + 1):
                    if (e.id, dates[k]) in approved_leaves_set:
                        days_off.append(model.NewConstant(1))
                model.Add(sum(days_off) >= 1)
        
        for d_idx in range(num_days - window_size + 1):
            worked_days = []
            for k in range(window_size):
                cur_d = d_idx + k
                if (e.id, dates[cur_d]) in approved_leaves_set:
                    pass
                else:
                    worked_days.append(sum(x[(e.id, cur_d, s_id)] for s_id in shift_ids))
            if worked_days:
                model.Add(sum(worked_days) <= max_streak)

    # ── 4. Minimum Rest Between Consecutive Shifts ───────────────────────────
    for e in req.employees:
        for d_idx in range(num_days - 1):
            # Evening -> Morning next day (rest < 8h)
            for e_sid in evening_shift_ids:
                for m_sid in morning_shift_ids:
                    model.Add(x[(e.id, d_idx, e_sid)] + x[(e.id, d_idx + 1, m_sid)] <= 1)
            
            # Night -> Morning next day (only if seamless transition is disabled)
            if active_rules.require_off_after_night_shift:
                for n_sid in night_shift_ids:
                    for m_sid in morning_shift_ids:
                        model.Add(x[(e.id, d_idx, n_sid)] + x[(e.id, d_idx + 1, m_sid)] <= 1)
                    for ev_sid in evening_shift_ids:
                        model.Add(x[(e.id, d_idx, n_sid)] + x[(e.id, d_idx + 1, ev_sid)] <= 1)

    # ── 5. Night Shift Rotation & Distribution ───────────────────────────────
    # Non-eligible staff cannot do night shift
    for e in req.employees:
        if not e.is_night_eligible and night_shift_ids:
            for d_idx in range(num_days):
                for n_sid in night_shift_ids:
                    model.Add(x[(e.id, d_idx, n_sid)] == 0)

    # Structured Rotation Blocks (e.g. 2 staff, 3 days block: Days 0..2 & Days 3..5)
    if night_shift_ids and active_rules.total_night_employees and active_rules.night_rotation_block_days:
        tot_n = active_rules.total_night_employees
        block_len = active_rules.night_rotation_block_days
        
        # Identify blocks of length block_len (e.g. 0..2 and 3..5)
        blocks = []
        cur_start = 0
        while cur_start + block_len <= num_days and len(blocks) < tot_n:
            blocks.append((cur_start, cur_start + block_len))
            cur_start += block_len

        block_emp_vars = []
        for b_idx, (b_start, b_end) in enumerate(blocks):
            b_emps = [model.NewBoolVar(f"b_emp_b{b_idx}_e{e.id}") for e in req.employees]
            for idx, e in enumerate(req.employees):
                emp_block_nights = [
                    x[(e.id, d_idx, n_sid)]
                    for d_idx in range(b_start, b_end)
                    for n_sid in night_shift_ids
                ]
                # If b_emps[idx] is True, employee works all nights in this block
                model.Add(sum(emp_block_nights) == (b_end - b_start)).OnlyEnforceIf(b_emps[idx])
                model.Add(sum(emp_block_nights) == 0).OnlyEnforceIf(b_emps[idx].Not())
            # Exactly 1 employee covers this night block
            model.Add(sum(b_emps) == 1)
            block_emp_vars.append(b_emps)

        # All block employees must be distinct individuals
        for idx in range(len(req.employees)):
            model.Add(sum(b_emps[idx] for b_emps in block_emp_vars) <= 1)

        # Staff not selected for rotation blocks do not work night shifts
        for idx, e in enumerate(req.employees):
            is_assigned_to_any_block = model.NewBoolVar(f"in_any_block_e{e.id}")
            model.Add(sum(b_emps[idx] for b_emps in block_emp_vars) == 1).OnlyEnforceIf(is_assigned_to_any_block)
            model.Add(sum(b_emps[idx] for b_emps in block_emp_vars) == 0).OnlyEnforceIf(is_assigned_to_any_block.Not())
            
            # If not in any block, 0 night shifts
            for d_idx in range(num_days):
                for n_sid in night_shift_ids:
                    model.Add(x[(e.id, d_idx, n_sid)] == 0).OnlyEnforceIf(is_assigned_to_any_block.Not())

        # Days outside rotation blocks (e.g. day 6 if 2 blocks of 3 days cover days 0..5) have 0 night shifts
        covered_days = sum((b_end - b_start) for (b_start, b_end) in blocks)
        for rem_d in range(covered_days, num_days):
            for e in req.employees:
                for n_sid in night_shift_ids:
                    model.Add(x[(e.id, rem_d, n_sid)] == 0)

    elif night_shift_ids:
        # Standard night shift quota
        max_nights_per_week = active_rules.max_night_shifts_per_week or 3
        if max_nights_per_week > 0:
            for e in req.employees:
                for w_start in range(0, num_days, 7):
                    w_end = min(w_start + 7, num_days)
                    night_vars = [
                        x[(e.id, d_idx, n_sid)]
                        for d_idx in range(w_start, w_end)
                        for n_sid in night_shift_ids
                    ]
                    if night_vars:
                        model.Add(sum(night_vars) <= max_nights_per_week)

        # Night shift per-day cap (prevent clustering multiple staff on the same night unless requested)
        night_cap = active_rules.max_staff_per_shift.get('N') or active_rules.min_staff_per_shift.get('N', 1)
        for d_idx in range(num_days):
            model.Add(sum(x[(e.id, d_idx, n_sid)] for e in req.employees for n_sid in night_shift_ids) <= max(1, night_cap))

    # ── 6. Weekly Off Quota per Employee ─────────────────────────────────────
    target_offs_per_week = active_rules.weekly_offs_per_employee or 1
    for e in req.employees:
        for w_start in range(0, num_days, 7):
            w_end = min(w_start + 7, num_days)
            block_len = w_end - w_start
            if block_len >= 5:
                off_vars = []
                leaves_count = 0
                for d_idx in range(w_start, w_end):
                    if (e.id, dates[d_idx]) in approved_leaves_set:
                        leaves_count += 1
                    else:
                        off_vars.append(w[(e.id, d_idx)])
                
                req_offs = max(0, target_offs_per_week - leaves_count)
                if active_rules.exact_weekly_offs:
                    # Exact weekly off constraint
                    model.Add(sum(off_vars) == req_offs)
                else:
                    model.Add(sum(off_vars) >= req_offs)
                    extra_offs = model.NewIntVar(0, block_len, f"extra_offs_e{e.id}_w{w_start}")
                    model.Add(extra_offs >= sum(off_vars) - req_offs)
                    objective_terms.append(extra_offs * 100)

    # ── 7. Stagger Week-Offs Across the Week ──────────────────────────────────
    # Avoid having all staff take week-off on the same day; distribute evenly
    max_offs_per_day = max(1, math.ceil((num_employees * target_offs_per_week) / num_days))
    if num_employees >= 3:
        for d_idx in range(num_days):
            model.Add(sum(w[(e.id, d_idx)] for e in req.employees) <= max_offs_per_day)

    # ── 8. Shift Coverage Requirements (Soft with Slack Penalties) ───────────
    coverage_slacks = []
    for d_idx, d_str in enumerate(dates):
        for s in shifts:
            req_min = active_rules.min_staff_per_shift.get(s.shift_code) or active_rules.min_staff_per_shift.get(s.shift_name, 0)
            if req_min > 0:
                staff_assigned = [x[(e.id, d_idx, s.id)] for e in req.employees]
                slack = model.NewIntVar(0, req_min, f"slack_cov_d{d_idx}_s{s.id}")
                model.Add(sum(staff_assigned) + slack >= req_min)
                coverage_slacks.append((d_str, s.shift_name, s.shift_code, req_min, slack))
                objective_terms.append(slack * 1000)
            
            # Max staff cap if specified
            req_max = active_rules.max_staff_per_shift.get(s.shift_code) or active_rules.max_staff_per_shift.get(s.shift_name)
            if req_max is not None and req_max > 0:
                model.Add(sum(x[(e.id, d_idx, s.id)] for e in req.employees) <= req_max)

    # ── 9. Fairness & Distribution Optimization Terms ─────────────────────────
    # A. Prioritize default fill shift (e.g. Morning Shift) on all working days
    if fill_shift_id is not None:
        for e in req.employees:
            for d_idx in range(num_days):
                objective_terms.append(x[(e.id, d_idx, fill_shift_id)] * -20)

    # B. Balance total shifts worked across employees
    total_shifts_per_emp = []
    for e in req.employees:
        emp_shifts = [x[(e.id, d_idx, s_id)] for d_idx in range(num_days) for s_id in shift_ids]
        total_shifts = model.NewIntVar(0, num_days, f"tot_shifts_e{e.id}")
        model.Add(total_shifts == sum(emp_shifts))
        total_shifts_per_emp.append(total_shifts)

    if total_shifts_per_emp:
        min_tot = model.NewIntVar(0, num_days, "min_tot_shifts")
        max_tot = model.NewIntVar(0, num_days, "max_tot_shifts")
        model.AddMinEquality(min_tot, total_shifts_per_emp)
        model.AddMaxEquality(max_tot, total_shifts_per_emp)
        objective_terms.append((max_tot - min_tot) * 50)

    # C. Balance daily working staff count (smooth daily coverage)
    for d_idx in range(num_days):
        daily_offs = sum(w[(e.id, d_idx)] for e in req.employees)
        objective_terms.append(daily_offs * 5)

    # Minimize total objective penalties
    model.Minimize(sum(objective_terms))

    # ── Solve ────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    solver.parameters.num_workers = 4
    
    status_code = solver.Solve(model)
    solve_duration = round(time.time() - start_time, 3)
    
    status_str = "OPTIMAL" if status_code == cp_model.OPTIMAL else (
        "FEASIBLE" if status_code == cp_model.FEASIBLE else "INFEASIBLE"
    )
    
    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return RosterSolveResponse(
            status=status_str,
            solve_time_seconds=solve_duration,
            assignments=[],
            violations=[Violation(rule="NO_FEASIBLE_SOLUTION", severity="HARD", description="Unable to find a valid roster matching strict constraints. Please review leaves and headcount.")],
            metrics={},
            prompt_logs=prompt_logs,
            message="No feasible solution found with given constraints."
        )

    # ── Extract Assignments & Violations ─────────────────────────────────────
    assignments: List[RosterAssignment] = []
    violations: List[Violation] = []
    
    for (d_str, s_name, s_code, req_min, slack_var) in coverage_slacks:
        slack_val = solver.Value(slack_var)
        if slack_val > 0:
            violations.append(Violation(
                date=d_str,
                rule="COVERAGE_DEFICIT",
                severity="SOFT",
                description=f"Shift '{s_name}' ({s_code}) on {d_str} has {req_min - slack_val}/{req_min} staff ({slack_val} short due to headcount/leaves)."
            ))

    total_assigned_count = 0
    night_shift_counts: Dict[int, int] = {e.id: 0 for e in req.employees}
    shifts_per_emp_count: Dict[int, int] = {e.id: 0 for e in req.employees}

    for e in req.employees:
        for d_idx, d_str in enumerate(dates):
            is_leave = (e.id, d_str) in approved_leaves_set
            pin = pinned_map.get((e.id, d_str))
            
            if is_leave:
                assignments.append(RosterAssignment(
                    employee_id=e.id,
                    employee_name=e.name,
                    date=d_str,
                    shift_id=None,
                    shift_code="L",
                    shift_name="Leave",
                    is_week_off=False,
                    is_leave=True,
                    pinned=False
                ))
            elif solver.Value(w[(e.id, d_idx)]) == 1:
                assignments.append(RosterAssignment(
                    employee_id=e.id,
                    employee_name=e.name,
                    date=d_str,
                    shift_id=None,
                    shift_code="WO",
                    shift_name="Week Off",
                    is_week_off=True,
                    is_leave=False,
                    pinned=bool(pin and pin.is_week_off)
                ))
            else:
                assigned_sid = None
                for s_id in shift_ids:
                    if solver.Value(x[(e.id, d_idx, s_id)]) == 1:
                        assigned_sid = s_id
                        break
                
                if assigned_sid is not None:
                    s_obj = shift_by_id[assigned_sid]
                    total_assigned_count += 1
                    shifts_per_emp_count[e.id] += 1
                    if assigned_sid in night_shift_ids:
                        night_shift_counts[e.id] += 1
                    
                    assignments.append(RosterAssignment(
                        employee_id=e.id,
                        employee_name=e.name,
                        date=d_str,
                        shift_id=s_obj.id,
                        shift_code=s_obj.shift_code,
                        shift_name=s_obj.shift_name,
                        start_time=s_obj.start_time[:5] if s_obj.start_time else "08:00",
                        end_time=s_obj.end_time[:5] if s_obj.end_time else "16:00",
                        is_night_shift=bool(s_obj.is_night_shift or assigned_sid in night_shift_ids),
                        is_week_off=False,
                        is_leave=False,
                        pinned=bool(pin and (pin.shift_id == s_obj.id or pin.shift_code == s_obj.shift_code))
                    ))
                else:
                    assignments.append(RosterAssignment(
                        employee_id=e.id,
                        employee_name=e.name,
                        date=d_str,
                        shift_id=None,
                        shift_code="WO",
                        shift_name="Week Off",
                        is_week_off=True,
                        is_leave=False,
                        pinned=False
                    ))

    fairness_score = 100
    if shifts_per_emp_count:
        counts = list(shifts_per_emp_count.values())
        diff = max(counts) - min(counts)
        fairness_score = max(70, 100 - (diff * 5) - (len(violations) * 3))

    metrics = {
        "fairness_score": fairness_score,
        "total_shifts_assigned": total_assigned_count,
        "total_days": num_days,
        "total_employees": num_employees,
        "coverage_deficits": len(violations),
        "shifts_per_employee": {emp_by_id[eid].name: cnt for eid, cnt in shifts_per_emp_count.items()},
        "night_shifts_per_employee": {emp_by_id[eid].name: cnt for eid, cnt in night_shift_counts.items()}
    }

    return RosterSolveResponse(
        status=status_str,
        solve_time_seconds=solve_duration,
        assignments=assignments,
        violations=violations,
        metrics=metrics,
        prompt_logs=prompt_logs,
        message="Roster generated successfully with mathematical constraint satisfaction."
    )
