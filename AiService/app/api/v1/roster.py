from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
from app.core.config import settings
from app.models.roster_schema import RosterSolveRequest, RosterSolveResponse
from app.services.roster_solver import solve_roster

router = APIRouter(prefix="/roster", tags=["Roster Optimization"])

def verify_internal_key(x_internal_key: Optional[str] = Header(None)):
    # If a service key is configured, verify header
    if settings.INTERNAL_SERVICE_KEY and x_internal_key:
        if x_internal_key != settings.INTERNAL_SERVICE_KEY:
            raise HTTPException(status_code=403, detail="Invalid internal service key")
    return True

@router.post("/solve", response_model=RosterSolveResponse)
def solve_roster_endpoint(
    req: RosterSolveRequest,
    _auth: bool = Depends(verify_internal_key)
):
    try:
        response = solve_roster(req)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")
