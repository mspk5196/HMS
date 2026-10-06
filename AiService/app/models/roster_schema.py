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

class RosterRulesInput(BaseModel):
    min_staff_per_shift: Dict[str, int] = Field(default_factory=dict)  # {"M": 3, "E": 2, "N": 1}
    role_coverage: Dict[str, Dict[str, int]] = Field(default_factory=dict) # {"M": {"Staff Nurse": 2}}
    min_rest_hours_between_shifts: int = 12
    max_consecutive_working_days: int = 6
    max_night_shifts_per_week: int = 3
    require_off_after_night_shift: bool = True
    weekly_offs_per_employee: int = 1
    approved_leaves: List[LeaveConstraint] = Field(default_factory=list)
    pinned_shifts: List[PinnedShift] = Field(default_factory=list)

class RosterSolveRequest(BaseModel):
    department_id: int
    staff_role_id: Optional[int] = None
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    employees: List[EmployeeInput]
    shifts: List[ShiftInput]
    rules: RosterRulesInput
    prompt: Optional[str] = None  # Natural language instruction from admin
    history: Optional[List[Dict[str, Any]]] = None  # Last week shifts for consecutive day continuity

class RosterAssignment(BaseModel):
    employee_id: int
    employee_name: str
    date: str  # YYYY-MM-DD
    shift_id: Optional[int] = None
    shift_code: str  # "M", "E", "N", "G", "WO", "L"
    shift_name: str
    is_week_off: bool = False
    is_leave: bool = False
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
