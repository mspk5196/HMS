from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "engine": "Google OR-Tools CP-SAT (Constraint Satisfaction Solver)",
        "capabilities": [
            "ai_duty_roster_generation",
            "clinical_voice_dictation",
            "prescription_parsing"
        ]
    }
