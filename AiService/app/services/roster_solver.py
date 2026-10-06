"""
roster_solver.py
High-performance Staff Duty Roster Scheduling Engine using Google OR-Tools CP-SAT.
Solves hospital scheduling with hard constraints (coverage, rest, leaves, fatigue)
and soft fairness optimization.
"""

import time
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
        active_rules, prompt_logs = parse_admin_prompt(
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
    
    # Identify night shift IDs
    night_shift_ids = {s.id for s in shifts if s.is_night_shift or "night" in s.shift_name.lower() or s.shift_code == "N"}
    morning_shift_ids = {s.id for s in shifts if "morning" in s.shift_name.lower() or s.shift_code == "M"}
    evening_shift_ids = {s.id for s in shifts if "evening" in s.shift_name.lower() or s.shift_code == "E"}
    
    # Set of approved leaves: (emp_id, date_str)
    approved_leaves_set = {(l.employee_id, l.date) for l in active_rules.approved_leaves}
    
    # Map of pinned shifts: (emp_id, date_str) -> PinnedShift
    pinned_map = {(p.employee_id, p.date): p for p in active_rules.pinned_shifts}
    
    # History for consecutive working days continuity
    # emp_id -> count of consecutive working days right before start_date
    history_streak: Dict[int, int] = {}
    if req.history:
        prev_date = format_date(parse_date(req.start_date) - timedelta(days=1))
        # Build consecutive worked days map
        for h in req.history:
            e_id = h.get("employee_id")
            streak = h.get("consecutive_worked_days", 0)
            if e_id and streak:
                history_streak[e_id] = min(streak, active_rules.max_consecutive_working_days)

    # ── CP-SAT Model Initialization ──────────────────────────────────────────
    model = cp_model.CpModel()
    
    # Decision Variables:
    # x[e, d, s] == 1 if employee e works shift s on day d
    # w[e, d] == 1 if employee e has a Week-Off on day d
    x = {}
    w = {}
    
    for e in req.employees:
        for d_idx, d_str in enumerate(dates):
            w[(e.id, d_idx)] = model.NewBoolVar(f"w_e{e.id}_d{d_idx}")
            for s_id in shift_ids:
                x[(e.id, d_idx, s_id)] = model.NewBoolVar(f"x_e{e.id}_d{d_idx}_s{s_id}")

    # ── 1. Daily Mutex Constraint ────────────────────────────────────────────
    # Each employee has exactly 1 state per day: exactly one shift OR Week-Off OR Leave
    for e in req.employees:
        for d_idx, d_str in enumerate(dates):
            is_leave = (e.id, d_str) in approved_leaves_set
            if is_leave:
                # Forced Leave
                model.Add(w[(e.id, d_idx)] == 0)
                for s_id in shift_ids:
                    model.Add(x[(e.id, d_idx, s_id)] == 0)
            else:
                # Sum of shifts + week_off == 1
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
        elif pin.shift_id and pin.shift_id in shift_by_id:
            model.Add(x[(e_id, d_idx, pin.shift_id)] == 1)
        elif pin.shift_code and pin.shift_code in shift_by_code:
            target_sid = shift_by_code[pin.shift_code].id
            model.Add(x[(e_id, d_idx, target_sid)] == 1)

    # ── 3. Maximum Consecutive Working Days ──────────────────────────────────
    max_streak = active_rules.max_consecutive_working_days or 6
    window_size = max_streak + 1
    
    for e in req.employees:
        # Check start-of-month continuity from history
        prior_streak = history_streak.get(e.id, 0)
        if prior_streak > 0 and prior_streak < max_streak:
            remaining_allowed = max_streak - prior_streak
            if remaining_allowed < num_days:
                # Must have at least one day off in dates[0..remaining_allowed]
                days_off = [w[(e.id, k)] for k in range(remaining_allowed + 1)]
                for k in range(remaining_allowed + 1):
                    if (e.id, dates[k]) in approved_leaves_set:
                        days_off.append(model.NewConstant(1))
                model.Add(sum(days_off) >= 1)
        
        # Standard rolling window of length (max_streak + 1)
        for d_idx in range(num_days - window_size + 1):
            worked_days = []
            for k in range(window_size):
                cur_d = d_idx + k
                if (e.id, dates[cur_d]) in approved_leaves_set:
                    # Leave is an off day
                    pass
                else:
                    # Worked = 1 - w
                    # sum(worked_days) <= max_streak <=> sum(w) >= 1
                    worked_days.append(sum(x[(e.id, cur_d, s_id)] for s_id in shift_ids))
            if worked_days:
                model.Add(sum(worked_days) <= max_streak)

    # ── 4. Minimum Rest Between Consecutive Shifts ───────────────────────────
    # Evening -> Morning next day (rest < 8h)
    # Night -> Morning / Evening next day
    for e in req.employees:
        for d_idx in range(num_days - 1):
            # Evening -> Morning next day
            for e_sid in evening_shift_ids:
                for m_sid in morning_shift_ids:
                    model.Add(x[(e.id, d_idx, e_sid)] + x[(e.id, d_idx + 1, m_sid)] <= 1)
            
            # Night -> Morning next day
            for n_sid in night_shift_ids:
                for m_sid in morning_shift_ids:
                    model.Add(x[(e.id, d_idx, n_sid)] + x[(e.id, d_idx + 1, m_sid)] <= 1)
                
                # Night -> Evening next day (if 24h rest is requested)
                if active_rules.require_off_after_night_shift:
                    for ev_sid in evening_shift_ids:
                        model.Add(x[(e.id, d_idx, n_sid)] + x[(e.id, d_idx + 1, ev_sid)] <= 1)

    # ── 5. Night Shift Eligibility & Quotas ──────────────────────────────────
    for e in req.employees:
        # If employee not eligible for night shifts
        if not e.is_night_eligible and night_shift_ids:
            for d_idx in range(num_days):
                for n_sid in night_shift_ids:
                    model.Add(x[(e.id, d_idx, n_sid)] == 0)
        
        # Max night shifts per week
        max_nights_per_week = active_rules.max_night_shifts_per_week or 3
        if night_shift_ids and max_nights_per_week > 0:
            for w_start in range(0, num_days, 7):
                w_end = min(w_start + 7, num_days)
                night_vars = [
                    x[(e.id, d_idx, n_sid)]
                    for d_idx in range(w_start, w_end)
                    for n_sid in night_shift_ids
                ]
                if night_vars:
                    model.Add(sum(night_vars) <= max_nights_per_week)

    # ── 6. Weekly Off Quota per Employee ─────────────────────────────────────
    # Each full 7-day period should have at least 1 week-off (or leave)
    target_offs_per_week = active_rules.weekly_offs_per_employee or 1
    for e in req.employees:
        for w_start in range(0, num_days, 7):
            w_end = min(w_start + 7, num_days)
            if (w_end - w_start) >= 5:  # Only enforce on blocks of 5+ days
                off_vars = []
                for d_idx in range(w_start, w_end):
                    if (e.id, dates[d_idx]) in approved_leaves_set:
                        off_vars.append(model.NewConstant(1))
                    else:
                        off_vars.append(w[(e.id, d_idx)])
                model.Add(sum(off_vars) >= target_offs_per_week)

    # ── 7. Shift Coverage Requirements (Soft with Slack Penalties) ───────────
    # If headcount is short, we allow slack variables with high penalties
    # so the solver always produces the best feasible schedule and flags deficits.
    coverage_slacks = []
    objective_terms = []
    
    # Check shift minimums
    for d_idx, d_str in enumerate(dates):
        for s in shifts:
            req_min = 0
            if s.shift_code in active_rules.min_staff_per_shift:
                req_min = active_rules.min_staff_per_shift[s.shift_code]
            elif s.shift_name in active_rules.min_staff_per_shift:
                req_min = active_rules.min_staff_per_shift[s.shift_name]
            
            if req_min > 0:
                staff_assigned = [x[(e.id, d_idx, s.id)] for e in req.employees]
                # slack = max(0, req_min - staff_assigned)
                slack = model.NewIntVar(0, req_min, f"slack_cov_d{d_idx}_s{s.id}")
                model.Add(sum(staff_assigned) + slack >= req_min)
                coverage_slacks.append((d_str, s.shift_name, s.shift_code, req_min, slack))
                # Heavy penalty for understaffing
                objective_terms.append(slack * 1000)

    # ── 8. Fairness Optimization Terms ───────────────────────────────────────
    # A. Balance total shifts worked across employees
    # B. Balance night shifts across eligible employees
    # C. Consecutive week-offs preference (encourage 2-day off blocks over isolated single offs)
    
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
        # Penalize difference between most-worked and least-worked employee
        objective_terms.append((max_tot - min_tot) * 50)

    # Balance Night Shifts
    if night_shift_ids:
        night_shifts_per_emp = []
        for e in req.employees:
            if e.is_night_eligible:
                emp_nights = [x[(e.id, d_idx, s_id)] for d_idx in range(num_days) for s_id in night_shift_ids]
                tot_n = model.NewIntVar(0, num_days, f"tot_nights_e{e.id}")
                model.Add(tot_n == sum(emp_nights))
                night_shifts_per_emp.append(tot_n)
        if len(night_shifts_per_emp) >= 2:
            min_n = model.NewIntVar(0, num_days, "min_night_shifts")
            max_n = model.NewIntVar(0, num_days, "max_night_shifts")
            model.AddMinEquality(min_n, night_shifts_per_emp)
            model.AddMaxEquality(max_n, night_shifts_per_emp)
            objective_terms.append((max_n - min_n) * 30)

    # Encourage Consecutive Week-Offs (w[e, d] == 1 and w[e, d+1] == 1)
    for e in req.employees:
        for d_idx in range(num_days - 1):
            pair_off = model.NewBoolVar(f"pair_off_e{e.id}_d{d_idx}")
            model.AddBoolAnd([w[(e.id, d_idx)], w[(e.id, d_idx + 1)]]).OnlyEnforceIf(pair_off)
            model.AddBoolOr([w[(e.id, d_idx)].Not(), w[(e.id, d_idx + 1)].Not()]).OnlyEnforceIf(pair_off.Not())
            # Reward paired offs
            objective_terms.append(pair_off * -5)

    # Minimize total penalties
    model.Minimize(sum(objective_terms))

    # ── Solve ────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0  # Max 10s budget
    solver.parameters.num_workers = 4             # Multi-threaded search
    
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
    
    # Check coverage deficit slacks
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
                        is_week_off=False,
                        is_leave=False,
                        pinned=bool(pin and (pin.shift_id == s_obj.id or pin.shift_code == s_obj.shift_code))
                    ))
                else:
                    # Fallback Week Off
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

    # Calculate metrics
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
