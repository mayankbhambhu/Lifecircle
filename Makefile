.PHONY: install dev-api dev-web build run test seed

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev-api:          ## API on :8000 (auto-seeds demo data)
	cd backend && uvicorn app.main:app --reload --port 8000

dev-web:          ## Vite on :5173, proxies /api to :8000
	cd frontend && npm run dev

build:            ## Build the frontend so the API serves it on :8000
	cd frontend && npm run build

run: build       ## One process: API + built app on http://localhost:8000
	cd backend && uvicorn app.main:app --port 8000

test:
	cd backend && python -m pytest -q

seed:             ## Reset the demo world (dates are relative to today)
	cd backend && python -m app.seed
