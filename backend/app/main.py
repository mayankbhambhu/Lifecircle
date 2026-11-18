"""LifeCircle API.

Run:  uvicorn app.main:app --reload --host 0.0.0.0     (from the backend/ folder)
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import date

from fastapi import FastAPI

from .config import settings
from .database import SessionLocal
from .routers import auth, bank, common, donor, family, hospital
from .seed import seed_if_empty
from .services import urgent
from .services.planning import run_reminders

log = logging.getLogger("lifecircle")


def run_scheduler_once() -> dict:
    with SessionLocal() as db:
        sent = run_reminders(db, date.today())
        escalated = urgent.run_due_escalations(db)
        db.commit()
        return {"reminders": sent, "escalated": escalated}


async def _scheduler_loop():
    while True:
        try:
            await asyncio.to_thread(run_scheduler_once)
        except Exception:  # never let the loop die
            log.exception("scheduler tick failed")
        await asyncio.sleep(settings.background_tick_seconds)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    seed_if_empty()
    task = asyncio.create_task(_scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title="LifeCircle API", version="1.0.0", lifespan=lifespan,
              description="Proactive blood-donation scheduling for patients who need regular transfusions.")

for r in (auth.router, family.router, donor.router, bank.router, hospital.router, common.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True}

