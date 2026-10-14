import logging
import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.roster import router as roster_router
from app.api.v1.voice import router as voice_router

logger = logging.getLogger("ai_service")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Dedicated Standalone AI & Optimization Microservice for Neha Hospitals HMS"
)

# CORS configuration restricted to authorized backend services
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["X-Internal-Key", "X-Tenant-ID", "X-Tenant-Code", "X-Branch-ID", "Content-Type", "Authorization"],
)

# Internal security & tenant context middleware
@app.middleware("http")
async def verify_internal_auth(request: Request, call_next):
    path = request.url.path

    # Public/Health endpoints exempt from secret key
    if path in ["/", "/docs", "/openapi.json"] or path.endswith("/health"):
        return await call_next(request)

    # Validate server-to-server shared secret
    internal_key = request.headers.get("x-internal-key") or request.headers.get("X-Internal-Key")
    if not internal_key or internal_key != settings.INTERNAL_SERVICE_KEY:
        logger.warning(f"[Security] Unauthorized access attempt to {path} from {request.client.host if request.client else 'unknown'}")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Unauthorized: Invalid or missing X-Internal-Key"}
        )

    # Extract tenant context
    tenant_id = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID") or "default"
    tenant_code = request.headers.get("x-tenant-code") or request.headers.get("X-Tenant-Code") or "NEHA"
    branch_id = request.headers.get("x-branch-id") or request.headers.get("X-Branch-ID")

    request.state.tenant_id = tenant_id
    request.state.tenant_code = tenant_code
    request.state.branch_id = branch_id

    logger.info(f"[TenantContext] Tenant={tenant_code} ({tenant_id}) Branch={branch_id} Path={path}")

    return await call_next(request)

# Mount Routers
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(roster_router, prefix=settings.API_V1_STR)
app.include_router(voice_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
