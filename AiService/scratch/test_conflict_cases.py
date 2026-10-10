import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.roster_schema import RosterSolveRequest, EmployeeInput, ShiftInput, RosterRulesInput, LeaveConstraint
from app.services.roster_solver import solve_roster

def test_conflict_cases():
    employees = [
        EmployeeInput(id=1, name="Dr. Rajesh", role_name="Doctor", is_doctor=True, is_night_eligible=True),
        EmployeeInput(id=2, name="Dr. Aiswarya", role_name="Doctor", is_doctor=True, is_night_eligible=True),
        EmployeeInput(id=3, name="Sister Priya", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
    ]

    shifts = [
        ShiftInput(id=1, shift_code="M", shift_name="Morning Shift", start_time="08:00:00", end_time="16:00:00", is_night_shift=False),
        ShiftInput(id=2, shift_code="N", shift_name="Night Shift", start_time="20:00:00", end_time="08:00:00", is_night_shift=True),
    ]

    # Sister Priya is on approved leave on 2026-10-02 (day 1 of the week)
    leaves = [
        LeaveConstraint(employee_id=3, date="2026-10-02")
    ]

    rules = RosterRulesInput(approved_leaves=leaves)

    # Prompt asks Priya to handle first 3 days (2026-10-01, 2026-10-02, 2026-10-03)
    req = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=rules,
        history=[],
        prompt="Sister Priya should handle first 3 days night shift. Dr. Rajesh should handle next 3 days night shift.",
        shift_mode="prompt_only"
    )

    res = solve_roster(req)
    print(f"Status: {res.status}")
    print(f"Violations: {[v.description for v in res.violations]}")
    print(f"Assignments count: {len(res.assignments)}")

if __name__ == "__main__":
    test_conflict_cases()
