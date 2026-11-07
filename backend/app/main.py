import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .api.routes import router as api_router
from .config import FRONTEND_DIST_DIR

app = FastAPI(
    title="TCT AnsiblePulse API",
    description="Observability Layer for Fragmented Ansible & IaC Scripts - Duplicate Detection, Blast Radius & Risk Flagging",
    version="1.0.0"
)

# Enable CORS for local development (Vite runs on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")

# Serve frontend build if dist directory exists
if os.path.exists(FRONTEND_DIST_DIR) and os.path.exists(os.path.join(FRONTEND_DIST_DIR, "index.html")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't intercept API calls
        if full_path.startswith("api"):
            return None
        file_path = os.path.join(FRONTEND_DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST_DIR, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "name": "TCT AnsiblePulse - Observability Layer for Fragmented Ansible & IaC Scripts",
            "status": "online",
            "api_docs": "/docs",
            "endpoints": ["/api/summary", "/api/duplicates", "/api/blast-radius", "/api/risks", "/api/inventory"]
        }
