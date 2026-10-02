$env:VERSION = "v1.3.4"
$env:DOCKERHUB_USER = "pcdpbit"

# ─── Frontend ─────────────────────────────────────────────────────────────────
Write-Host "Building and pushing nehahospital-frontend image ($env:VERSION)..." -ForegroundColor Cyan
docker build `
  --build-arg VITE_API_URL="https://neha.tylo.co.in/api" `
  -t nehahospital-frontend:$env:VERSION `
  -f .\HospitalsWeb\Dockerfile .\HospitalsWeb

docker tag nehahospital-frontend:$env:VERSION $env:DOCKERHUB_USER/nehahospital-frontend:$env:VERSION
docker push $env:DOCKERHUB_USER/nehahospital-frontend:$env:VERSION

# ─── Backend ──────────────────────────────────────────────────────────────────
Write-Host "Building and pushing nehahospital-backend image ($env:VERSION)..." -ForegroundColor Cyan
docker build `
  -t nehahospital-backend:$env:VERSION `
  -f .\Backend\Dockerfile .\Backend

docker tag nehahospital-backend:$env:VERSION $env:DOCKERHUB_USER/nehahospital-backend:$env:VERSION
docker push $env:DOCKERHUB_USER/nehahospital-backend:$env:VERSION

Write-Host "✅ Docker images pushed successfully to Docker Hub!" -ForegroundColor Green
