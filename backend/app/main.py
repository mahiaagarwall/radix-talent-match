"""RADIX Talent Match — FastAPI integration skeleton.

This is a placeholder so the frontend's API mode has a known shape to talk to.
Only /api/health is implemented. Every module endpoint returns 501 until its
owner implements it (see docs/api-contract.md for request/response shapes).

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as api_router

app = FastAPI(title="RADIX Talent Match API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "radix-talent-match", "modules_implemented": []}


app.include_router(api_router, prefix="/api")
