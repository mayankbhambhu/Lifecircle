# Run these from the repo root (the folder with this Makefile).
# The backend/ and mobile/ folders forward to this file, so `make <target>` works there too.

PYTHON ?= python3
VENV   := backend/.venv
PY     := $(abspath $(VENV))/bin/python

.PHONY: install api app test seed lint bundle

install:          ## Python deps (in backend/.venv) + npm deps for the Expo app
	@command -v $(PYTHON) >/dev/null || { echo "Python 3 not found – install it from python.org or 'brew install python'"; exit 1; }
	@command -v npm >/dev/null || { echo "Node.js not found – install Node 20+ from nodejs.org or 'brew install node'"; exit 1; }
	test -x $(PY) || $(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip -q
	$(PY) -m pip install -r backend/requirements.txt
	cd mobile && npm install

api:              ## FastAPI on 0.0.0.0:8000 so phones on the same Wi-Fi can reach it (auto-seeds demo data)
	cd backend && $(PY) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

app:              ## Expo dev server – scan the QR code with Expo Go
	cd mobile && npx expo start

test:
	cd backend && $(PY) -m pytest -q

lint:
	cd mobile && npx expo lint

bundle:           ## Compile the Android JS bundle without a device (sanity check)
	cd mobile && npx expo export --platform android --output-dir /tmp/lifecircle-bundle

seed:             ## Reset the demo world (dates are relative to today)
	cd backend && $(PY) -m app.seed
