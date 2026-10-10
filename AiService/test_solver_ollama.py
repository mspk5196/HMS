import json
from app.models.roster_schema import RosterSolveRequest, EmployeeInput, ShiftInput, RosterRulesInput
from app.services.roster_solver import solve_roster

def test_full_pipeline():
    employees = [
        EmployeeInput(id=1, name="Aiswarya", role_name="Staff Nurse"),
        EmployeeInput(id=2, name="Kavitha", role_name="Staff Nurse"),
        EmployeeInput(id=3, name="Marasamy", role_name="Senior Nurse"),
        EmployeeInput(id=4, name="Priya", role_name="Staff Nurse"),
    ]
    
    shifts = [
        ShiftInput(id=1, shift_code="M", shift_name="Morning", start_time="07:00:00", end_time="15:00:00", is_night_shift=False),
        ShiftInput(id=2, shift_code="E", shift_name="Evening", start_time="15:00:00", end_time="23:00:00", is_night_shift=False),
        ShiftInput(id=3, shift_code="N", shift_name="Night", start_time="23:00:00", end_time="07:00:00", is_night_shift=True),
    ]
    
    req = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-07",
        end_date="2026-10-09",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(
            min_staff_per_shift={"M": 1, "E": 1, "N": 1},
            max_consecutive_working_days=5
        ),
        prompt="Aiswarya should only work Morning shift."
    )
    
    print("Running solve_roster with prompt...")
    res = solve_roster(req)
    print("Status:", res.status)
    print("Solve time:", res.solve_time_seconds, "s")
    print("Total assignments:", len(res.assignments))
    print("Prompt logs:")
    for l in res.prompt_logs:
        print("  -", l)
    
    aiswarya_shifts = [a for a in res.assignments if a.employee_id == 1]
    print("\nAiswarya assignments:")
    for a in aiswarya_shifts:
        print(f"  Date: {a.date}, Shift: {a.shift_code} ({a.shift_name}), WeekOff: {a.is_week_off}")

if __name__ == "__main__":
    test_full_pipeline()

