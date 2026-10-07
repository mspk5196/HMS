from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class EmployeeInput(BaseModel):
    id: int
    name: str
    staff_role_id: Optional[int] = None
    role_name: Optional[str] = None
    gender: Optional[str] = None
    is_doctor: Optional[bool] = False
    is_night_eligible: Optional[bool] = True
    max_night_shifts: Optional[int] = None
    max_consecutive_days: Optional[int] = 6
    target_weekly_offs: Optional[int] = 1

class ShiftInput(BaseModel):
    id: int
    shift_code: str  # e.g. "M", "E", "N", "G"
    shift_name: str  # e.g. "Morning", "Evening", "Night", "General"
    start_time: str  # e.g. "07:00:00"
    end_time: str    # e.g. "15:00:00"
    is_night_shift: Optional[bool] = False
    is_active: Optional[bool] = True

class LeaveConstraint(BaseModel):
    employee_id: int
    date: str  # YYYY-MM-DD

class PinnedShift(BaseModel):
    employee_id: int
    date: str  # YYYY-MM-DD
    shift_id: Optional[int] = None
    shift_code: Optional[str] = None
    is_week_off: Optional[bool] = False
    shift_preference_only: Optional[bool] = False

class RosterRulesInput(BaseModel):
    min_staff_per_shift: Dict[str, int] = Field(default_factory=dict)  # {"M": 3, "E": 2, "N": 1}
    max_staff_per_shift: Dict[str, int] = Field(default_factory=dict)  # {"N": 1}
    role_coverage: Dict[str, Dict[str, int]] = Field(default_factory=dict) # {"M": {"Staff Nurse": 2}}
    min_rest_hours_between_shifts: int = 12
    max_consecutive_working_days: int = 6
    max_night_shifts_per_week: int = 3
    require_off_after_night_shift: bool = True
    weekly_offs_per_employee: int = 1
    exact_weekly_offs: bool = True
    total_night_employees: Optional[int] = None
    night_rotation_block_days: Optional[int] = None
    ordered_night_block_employees: List[int] = Field(default_factory=list)
    default_fill_shift: Optional[str] = None
    employee_preferred_shifts: Dict[int, str] = Field(default_factory=dict)  # {emp_id: "M"}
    disallowed_shifts: Dict[int, List[str]] = Field(default_factory=dict)  # {emp_id: ["N"]}
    day_specific_coverage: Dict[str, Dict[str, int]] = Field(default_factory=dict)  # {"Sunday": {"M": 1, "N": 1}}
    transition_from_last_week_nights: Optional[bool] = False
    approved_leaves: List[LeaveConstraint] = Field(default_factory=list)
    pinned_shifts: List[PinnedShift] = Field(default_factory=list)

class RosterSolveRequest(BaseModel):
    department_id: int
    staff_role_id: Optional[int] = None
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    employees: List[EmployeeInput]
    shifts: List[ShiftInput]
    rules: RosterRulesInput = Field(default_factory=RosterRulesInput)
    prompt: Optional[str] = None  # Natural language instruction from admin
    shift_mode: Optional[str] = "hybrid"  # "hybrid" | "configured_only" | "prompt_only"
    history: Optional[List[Dict[str, Any]]] = None  # Past shifts for historical continuity

class RosterAssignment(BaseModel):
    employee_id: int
    employee_name: str
    date: str  # YYYY-MM-DD
    shift_id: Optional[int] = None
    shift_code: str  # "M", "E", "N", "G", "WO", "L"
    shift_name: str
    is_week_off: bool = False
    is_leave: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_night_shift: bool = False
    pinned: bool = False

class Violation(BaseModel):
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    date: Optional[str] = None
    rule: str
    severity: str = "SOFT"  # "HARD" or "SOFT"
    description: str

class RosterSolveResponse(BaseModel):
    status: str  # "OPTIMAL", "FEASIBLE", "INFEASIBLE", "ERROR"
    solve_time_seconds: float
    assignments: List[RosterAssignment] = Field(default_factory=list)
    violations: List[Violation] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    prompt_logs: List[str] = Field(default_factory=list)
    message: str = "Success"
