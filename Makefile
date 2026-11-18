.PHONY: install api app test seed lint bundle

install:          ## Python deps for the API + npm deps for the Expo app
	cd backend && pip install -r requirements.txt
	cd mobile && npm install

api:              ## FastAPI on 0.0.0.0:8000 so phones on the same Wi-Fi can reach it (auto-seeds demo data)
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

app:              ## Expo dev server – scan the QR code with Expo Go
	cd mobile && npx expo start

test:
	cd backend && python -m pytest -q

lint:
	cd mobile && npx expo lint

bundle:           ## Compile the Android JS bundle without a device (sanity check)
	cd mobile && npx expo export --platform android --output-dir /tmp/lifecircle-bundle

seed:             ## Reset the demo world (dates are relative to today)
	cd backend && python -m app.seed
