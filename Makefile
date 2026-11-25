# LifeCircle tasks. Run from the repo root (backend/ and mobile/ forward here, so they work too).
#
#   make install   one-time setup: backend/.venv + npm packages
#   make api       FastAPI on 0.0.0.0:8000 (keep it running)
#   make app       Expo dev server, then scan the QR code with Expo Go
#   make test | make seed | make lint | make bundle
#
# Windows without make: double-click install.bat, api.bat and app.bat instead.

.PHONY: install api app test seed lint bundle

ifeq ($(OS),Windows_NT)
# ---------------------------------------------------------------- Windows
# Recipes run in cmd.exe and call the .bat scripts next to this file.
SHELL := cmd.exe
.SHELLFLAGS := /c

install: ; install.bat nopause
api:     ; api.bat
app:     ; app.bat
test:    ; test.bat nopause
seed:    ; seed.bat nopause
lint:    ; cd mobile && npx expo lint
bundle:  ; cd mobile && npx expo export --platform android --output-dir dist

else
# ---------------------------------------------------------------- macOS / Linux
PYTHON ?= python3
VENV   := backend/.venv
PY     := $(abspath $(VENV))/bin/python

install:
	@command -v $(PYTHON) >/dev/null || { echo "Python 3 not found – install it from python.org or 'brew install python'"; exit 1; }
	@command -v npm >/dev/null || { echo "Node.js not found – install Node 20+ from nodejs.org or 'brew install node'"; exit 1; }
	test -x $(PY) || $(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip -q
	$(PY) -m pip install -r backend/requirements.txt
	cd mobile && npm install

api:
	cd backend && $(PY) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

app:
	cd mobile && npx expo start

test:
	cd backend && $(PY) -m pytest -q

seed:
	cd backend && $(PY) -m app.seed

lint:
	cd mobile && npx expo lint

bundle:
	cd mobile && npx expo export --platform android --output-dir dist
endif
