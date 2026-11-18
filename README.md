# LifeCircle

**Proactive blood-donation scheduling for patients who need regular transfusions** (thalassemia major, sickle-cell disease, aplastic anaemia and others).

LifeCircle plans every transfusion ahead, rotates a family's donor circle fairly, sends reminders automatically, and when someone cancels it finds the nearest eligible donor, starting with the patient's own circle and then widening ring by ring.

| | |
|---|---|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2, SQLite (Postgres-ready), PyJWT |
| **Frontend** | React 18 + Vite, Framer Motion animations, Lucide icons, mobile-first app shell with light and dark themes |
| **Tests** | 39 pytest tests covering the algorithms, auth, RBAC, privacy leak checks, urgent escalation and stock alerts |

---

## Quick start

```bash
make install        # pip + npm
make run            # builds the app and serves everything on http://localhost:8000
```

For development with hot reload, use two terminals:

```bash
make dev-api        # FastAPI on :8000   (API docs at /docs)
make dev-web        # Vite on :5173      (proxies /api to :8000)
```

The demo data seeds itself on first start, with all dates relative to **today**. Run `make seed` to reset it.
On the login page, the **one-tap demo buttons** sign in as each role. You can also use OTP with a seeded number, for example `98000 00002` (Amit, a confirmed donor); in demo mode the code appears on screen.

| Env var | Default | Purpose |
|---|---|---|
| `LIFECIRCLE_SECRET` | dev value | JWT and OTP hashing key. **Set this in production.** |
| `LIFECIRCLE_DB` | `sqlite:///./lifecircle.db` | Any SQLAlchemy URL |
| `LIFECIRCLE_DEMO` | `true` | Shows OTP codes and magic links in the UI, plus one-tap demo logins |
| `GOOGLE_CLIENT_ID` | empty | Turns on real Google Identity Services sign-in. Without it, a simulated chooser is used in demo mode |
| `LIFECIRCLE_FRONTEND_URL` | `http://localhost:5173` | Base URL used in magic-link emails, and the CORS origin |

---

## What's inside

```
backend/app/
  services/
    eligibility.py   ← donor medical pre-eligibility (age, weight, 90/120-day gap, deferral, ABO/Rh)
    rotation.py      ← fair rotation: explainable 0-100 score, confirmed + backup, N-cycle forecast
    geo.py           ← haversine + bounding-box pre-filter, ring escalation 5→10→25→50 km
    scheduler.py     ← next-date maths and the T-7 / T-3 / T-1 reminder plan
    planning.py      ← the core loop: plan → cancel/promote → remind → complete → re-plan
    urgent.py        ← circle-first escalation, atomic first-accept-wins, re-route, fulfil from stock
    inventory.py     ← stock status (critical/low/healthy), shortage alerts, "rally donors"
    privacy.py       ← single place deciding what each role may see about a donor
    auth_methods.py  ← phone OTP, email magic link, Google ID-token verification
  security.py        ← JWT sessions + require_roles() route guard
  routers/           ← auth · family · donor · bank · hospital · common
  seed.py            ← the demo world (all people and organisations are fictional)
backend/tests/       ← test_algorithms.py, test_api.py
frontend/src/pages/  ← Landing · Login · Onboarding · PatientApp · DonorApp · BankApp · HospitalApp
docs/PRESENTATION.md ← problem, impact, design decisions, scope, demo script
```

See **[docs/PRESENTATION.md](docs/PRESENTATION.md)** for the algorithms, the privacy model, the "what this doesn't do" scope, and a 5-minute demo script.
