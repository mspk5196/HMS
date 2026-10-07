import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.roster_schema import RosterSolveRequest, EmployeeInput, ShiftInput, RosterRulesInput
from app.services.roster_solver import solve_roster

def test_user_exact_prompt():
    employees = [
        EmployeeInput(id=1, name="SUBASHINI S", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=2, name="MAHALAKSHMI G", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=3, name="PRIYA K", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=4, name="AISWARYA M", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=5, name="KAVITHA R", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
    ]

    shifts = [
        ShiftInput(id=1, shift_code="M", shift_name="Morning Shift", start_time="08:00:00", end_time="16:00:00", is_night_shift=False),
        ShiftInput(id=2, shift_code="E", shift_name="Evening Shift", start_time="16:00:00", end_time="00:00:00", is_night_shift=False),
        ShiftInput(id=3, shift_code="N", shift_name="Night Shift", start_time="20:00:00", end_time="08:00:00", is_night_shift=True),
    ]

    prompt = (
        "for this week two employee should be in night shift and in that one should be in first 3days "
        "and another should be in next 3 days and when first one ends night shift of last day of that 3days, "
        "he will work day shift for the last also then another employee continues from that night. "
        "Only one week off for each employee in this week and fill others with morning shift if there is no night shift and no week-off day. "
        "and in this SUBASHINI S should handle night shift as one of the two staff i mentioned. "
        "on last day put night shift for MAHALAKSHMI G"
    )

    req = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(),
        history=[],
        prompt=prompt,
        shift_mode="prompt_only"
    )

    res = solve_roster(req)
    print(f"Status: {res.status}, Solve Time: {res.solve_time_seconds}s")
    print("Prompt Logs:")
    for l in res.prompt_logs:
        print("  -", l)

    print("\nViolations:")
    for v in res.violations:
        print("  -", v.description)

    print("\nAssignments:")
    dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]
    for e in employees:
        emp_assignments = [a for a in res.assignments if a.employee_id == e.id]
        row = " | ".join([f"{a.shift_code}" for a in emp_assignments])
        print(f"{e.name:<15}: {row}")

if __name__ == "__main__":
    test_user_exact_prompt()
