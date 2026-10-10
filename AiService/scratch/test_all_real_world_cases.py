import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.roster_schema import RosterSolveRequest, EmployeeInput, ShiftInput, RosterRulesInput
from app.services.roster_solver import solve_roster

def test_real_world_cases():
    employees = [
        EmployeeInput(id=1, name="Dr. Rajesh", role_name="Doctor", is_doctor=True, is_night_eligible=True),
        EmployeeInput(id=2, name="Dr. Aiswarya", role_name="Doctor", is_doctor=True, is_night_eligible=True),
        EmployeeInput(id=3, name="Sister Priya", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=4, name="Sister Kavitha", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=5, name="Sister Mary", role_name="Senior Nurse", is_doctor=False, is_night_eligible=True),
    ]

    shifts = [
        ShiftInput(id=1, shift_code="M", shift_name="Morning Shift", start_time="08:00:00", end_time="16:00:00", is_night_shift=False),
        ShiftInput(id=2, shift_code="E", shift_name="Evening Shift", start_time="16:00:00", end_time="00:00:00", is_night_shift=False),
        ShiftInput(id=3, shift_code="N", shift_name="Night Shift", start_time="20:00:00", end_time="08:00:00", is_night_shift=True),
    ]

    print("=================================================================")
    print("CASE 1: Negative constraint ('Do not assign night shift to Kavitha')")
    print("=================================================================")
    req1 = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(),
        history=[],
        prompt="Do not assign night shift to Kavitha. Keep 1 staff on night duty every day.",
        shift_mode="prompt_only"
    )
    res1 = solve_roster(req1)
    print(f"Status: {res1.status}, Solve Time: {res1.solve_time_seconds}s")
    kavitha_shifts = [a.shift_code for a in res1.assignments if a.employee_id == 4]
    print(f"Kavitha's shifts: {kavitha_shifts}")
    assert 'N' not in kavitha_shifts, "Kavitha must NOT have any night shifts!"
    print(">>> CASE 1 PASSED!\n")

    print("=================================================================")
    print("CASE 2: Day-Specific Coverage ('On Sunday min 1 in morning, 1 in night')")
    print("=================================================================")
    req2 = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(),
        history=[],
        prompt="On Sunday min 1 in morning, 1 in night. Fill others with morning shift.",
        shift_mode="prompt_only"
    )
    res2 = solve_roster(req2)
    print(f"Status: {res2.status}, Solve Time: {res2.solve_time_seconds}s")
    # Sunday is 2026-10-04
    sun_shifts = [a.shift_code for a in res2.assignments if a.date == "2026-10-04"]
    print(f"Sunday (2026-10-04) shift coverage: {sun_shifts}")
    assert 'M' in sun_shifts, "Sunday must have Morning shift!"
    assert 'N' in sun_shifts, "Sunday must have Night shift!"
    print(">>> CASE 2 PASSED!\n")

    print("=================================================================")
    print("CASE 3: Over-constrained Prompt (Needs 8 staff, only 5 exist)")
    print("=================================================================")
    req3 = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(),
        history=[],
        prompt="Keep 4 staff in morning, 3 staff in evening, 2 staff in night every day.",
        shift_mode="prompt_only"
    )
    res3 = solve_roster(req3)
    print(f"Status: {res3.status}, Total Assignments: {len(res3.assignments)}, Violations: {len(res3.violations)}")
    assert res3.status in ("OPTIMAL", "FEASIBLE"), "Must not fail with INFEASIBLE on over-constrained headcount!"
    assert len(res3.assignments) == 35, "Must return complete assignments for all 5 staff across 7 days!"
    print(">>> CASE 3 PASSED: Gracefully handled over-constrained prompt!\n")

if __name__ == "__main__":
    test_real_world_cases()
