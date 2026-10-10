import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.roster_schema import RosterSolveRequest, EmployeeInput, ShiftInput, RosterRulesInput
from app.services.roster_solver import solve_roster

def run_tests():
    print("=================================================================")
    print("TEST 1: Historical Continuity ('if last week emp had night shift give day shift')")
    print("=================================================================")
    
    employees = [
        EmployeeInput(id=1, name="Dr. Aiswarya", role_name="Doctor", is_doctor=True, is_night_eligible=True),
        EmployeeInput(id=2, name="Nurse Priya", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=3, name="Nurse Mary", role_name="Staff Nurse", is_doctor=False, is_night_eligible=True),
        EmployeeInput(id=4, name="Dr. Rajesh", role_name="Senior Doctor", is_doctor=True, is_night_eligible=True),
    ]
    
    shifts = [
        ShiftInput(id=1, shift_code="M", shift_name="Morning Shift", start_time="08:00:00", end_time="16:00:00", is_night_shift=False),
        ShiftInput(id=2, shift_code="E", shift_name="Evening Shift", start_time="16:00:00", end_time="00:00:00", is_night_shift=False),
        ShiftInput(id=3, shift_code="N", shift_name="Night Shift", start_time="20:00:00", end_time="08:00:00", is_night_shift=True),
    ]
    
    # Nurse Priya worked night shifts in the past week
    history = [
        {"employee_id": 2, "date": "2026-09-28", "is_night_shift": True, "shift_code": "N", "shift_name": "Night Shift"},
        {"employee_id": 2, "date": "2026-09-29", "is_night_shift": True, "shift_code": "N", "shift_name": "Night Shift"},
        {"employee_id": 2, "date": "2026-09-30", "is_night_shift": True, "shift_code": "N", "shift_name": "Night Shift"},
    ]
    
    prompt = "if last week this emp has night shift give day shift for this week"
    
    req1 = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(min_staff_per_shift={"M": 1, "E": 1, "N": 1}),
        history=history,
        prompt=prompt,
        shift_mode="hybrid"
    )
    
    res1 = solve_roster(req1)
    print(f"Status: {res1.status}, Solve Time: {res1.solve_time_seconds}s")
    print("Prompt Logs:")
    for l in res1.prompt_logs:
        print("  -", l)
        
    priya_shifts = [a for a in res1.assignments if a.employee_id == 2]
    priya_shift_codes = [a.shift_code for a in priya_shifts]
    print(f"Nurse Priya's shifts for the week: {priya_shift_codes}")
    assert 'N' not in priya_shift_codes, "Nurse Priya should NOT have night shifts this week!"
    assert 'M' in priya_shift_codes, "Nurse Priya should have Morning/Day shifts this week!"
    print(">>> TEST 1 PASSED: Historical night shift staff rotated to Day shift successfully!\n")

    print("=================================================================")
    print("TEST 2: Monthly Roster Generation (30 Days)")
    print("=================================================================")
    
    req2 = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-30",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(min_staff_per_shift={"M": 1, "E": 1, "N": 1}),
        history=[],
        prompt="Keep 1 in night, 1 in morning, 1 in evening. Max 6 consecutive days.",
        shift_mode="hybrid"
    )
    
    res2 = solve_roster(req2)
    print(f"Status: {res2.status}, Solve Time: {res2.solve_time_seconds}s, Total Assignments: {len(res2.assignments)}")
    assert res2.status in ("OPTIMAL", "FEASIBLE"), "Monthly roster should be feasible!"
    assert res2.metrics.get("total_days") == 30, "Should span 30 days!"
    print(">>> TEST 2 PASSED: 30-day Monthly roster generated successfully!\n")

    print("=================================================================")
    print("TEST 3: Custom Prompt Timings & Shift Mode ('hybrid' vs 'configured_only')")
    print("=================================================================")
    
    # Prompt with custom timings
    timing_prompt = "Assign Aiswarya to 08:30 to 18:30 on 2026-10-02"
    
    req3_hybrid = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(),
        history=[],
        prompt=timing_prompt,
        shift_mode="hybrid"
    )
    res3_hybrid = solve_roster(req3_hybrid)
    print("Hybrid Mode Prompt Logs:")
    for l in res3_hybrid.prompt_logs:
        print("  -", l)
        
    aiswarya_oct2 = next((a for a in res3_hybrid.assignments if a.employee_id == 1 and a.date == "2026-10-02"), None)
    print(f"Aiswarya Oct 2 Shift: {aiswarya_oct2.shift_name} ({aiswarya_oct2.start_time}-{aiswarya_oct2.end_time})")
    assert "08:30" in str(aiswarya_oct2.start_time) and "18:30" in str(aiswarya_oct2.end_time), "Should create and assign custom 08:30-18:30 shift!"
    
    # Now in configured_only mode
    req3_configured = RosterSolveRequest(
        department_id=1,
        start_date="2026-10-01",
        end_date="2026-10-07",
        employees=employees,
        shifts=shifts,
        rules=RosterRulesInput(),
        history=[],
        prompt=timing_prompt,
        shift_mode="configured_only"
    )
    res3_configured = solve_roster(req3_configured)
    aiswarya_oct2_conf = next((a for a in res3_configured.assignments if a.employee_id == 1 and a.date == "2026-10-02"), None)
    print(f"Configured Only Oct 2 Shift: {aiswarya_oct2_conf.shift_name} ({aiswarya_oct2_conf.shift_code})")
    assert aiswarya_oct2_conf.shift_code in ("M", "E", "N"), "Configured only mode should strictly use configured shift codes!"
    print(">>> TEST 3 PASSED: Custom timings and shift modes work as expected!\n")

if __name__ == "__main__":
    run_tests()
