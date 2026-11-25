# LifeCircle

**Proactive blood-donation scheduling for patients who need regular transfusions** (thalassemia major, sickle-cell disease, aplastic anaemia and others), as a **mobile app you run in Expo Go**.

LifeCircle plans every transfusion ahead, rotates a family's donor circle fairly, and reminds donors automatically. When someone cancels, it finds the nearest eligible donor: the patient's own circle first, then a widening ring of verified donors nearby.

| | |
|---|---|
| **Mobile app** (`mobile/`) | Expo SDK 58 · React Native · Expo Router tabs per role · Reanimated 4 animations · SVG radar and countdown · SecureStore sessions · light and dark mode |
| **Backend** (`backend/`) | Python · FastAPI · SQLAlchemy 2 · SQLite (Postgres-ready) · PyJWT |
| **Tests** | 40 pytest tests: algorithms, auth flows, role access, privacy leak checks, urgent escalation, stock alerts |

---

## Run it on your phone (Expo Go)

You need **Python 3.10+**, **Node 20+**, and the **Expo Go** app ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)). Your phone and laptop must be on the **same Wi-Fi**.

### Windows

Double-click these files in the project folder, in this order (or type their names in a terminal there):

| Step | File | Same as |
|---|---|---|
| 1. One-time setup | **`install.bat`** | `make install` |
| 2. Start the API (keep the window open) | **`api.bat`** | `make api` |
| 3. Start the app (second window) | **`app.bat`** | `make app` |

Also: `test.bat` (run the backend tests) and `seed.bat` (reset the demo data; stop `api.bat` first).

* Install **Python 3.10+** from [python.org](https://www.python.org/downloads/) and tick **"Add python.exe to PATH"**, and **Node 20+** from [nodejs.org](https://nodejs.org/).
* When `api.bat` starts, Windows Firewall may ask about Python. Tick **Private networks** and click **Allow**, or your phone can't reach the laptop. In Wi-Fi settings, set your network's profile to **Private**.
* `api.bat` prints this computer's addresses. If the app says it can't reach the server, tap **Server** on the login screen and enter the address for your Wi-Fi adapter, e.g. `http://192.168.1.7:8000`. This often happens on laptops with VirtualBox, WSL or Hyper-V.
* Prefer typing commands in PowerShell? The same steps by hand, from the project folder: setup, once:

  ```powershell
  py -m venv backend\.venv
  ```

  ```powershell
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  ```

  ```powershell
  cd mobile; npm.cmd install; cd ..
  ```

  The API, in terminal 1:

  ```powershell
  cd backend; .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```

  The app, in terminal 2:

  ```powershell
  cd mobile; npx.cmd expo start
  ```

  (`npm.cmd` / `npx.cmd` avoid PowerShell's "running scripts is disabled" error.)
* If you installed `make` on Windows, `make install`, `make api` and `make app` work too; they call the `.bat` files.

### macOS / Linux

Run these from the project folder (they also work from inside `backend/` or `mobile/`):

```bash
make install
```

`make install` creates a private Python environment in `backend/.venv`, so it works with Homebrew Python on macOS too.

Terminal 1, the API. It listens on `0.0.0.0` so your phone can reach it, and seeds demo data on first start:

```bash
make api
```

Terminal 2, the app:

```bash
make app
```

### Then, on your phone

Scan the QR code: with the Camera app on iPhone, or from inside Expo Go on Android. The app finds your laptop's IP from Expo automatically and calls the API on port 8000.

* **The app shows "Can't reach the server"?** Check that the API is running with `--host 0.0.0.0`, that your laptop firewall allows port 8000, and that both devices are on the same network. You can also tap **Server** at the bottom of the login screen and enter `http://<laptop-ip>:8000`.
* **Using `npx expo start --tunnel`?** The tunnel only carries the app bundle, not the API, so set the server URL yourself on the login screen, or start the app with `EXPO_PUBLIC_API_URL=http://<reachable-host>:8000`.
* **Want the presentation demo?** Use the **one-tap demo** buttons on the login screen (patient family, donor, blood bank, hospital). Or sign in with phone OTP using `98000 00002` (Amit, a confirmed donor). In demo mode the code appears on screen.
* **Want to reset the demo?** Tap your avatar, then **Reset demo data**, or run `make seed` (`seed.bat` on Windows).

### Backend settings

| Env var | Default | Purpose |
|---|---|---|
| `LIFECIRCLE_SECRET` | dev value | JWT and OTP hashing key. **Set this in production.** |
| `LIFECIRCLE_DB` | `sqlite:///./lifecircle.db` | Any SQLAlchemy URL |
| `LIFECIRCLE_DEMO` | `true` | Shows OTP codes and magic links in the app, enables one-tap demo logins and `exp://` magic links |
| `GOOGLE_CLIENT_IDS` | empty | Comma-separated Google OAuth client IDs whose ID tokens the API accepts |
| `LIFECIRCLE_APP_LINK` | `lifecircle://magic` | Where emailed magic links open when the app doesn't say otherwise |

### Sign-in methods inside Expo Go

| Method | In Expo Go |
|---|---|
| **Phone OTP** | Works. The code is shown as a "demo SMS" until an SMS gateway is wired up. |
| **Email magic link** | Works. The link opens the app (an `exp://…/--/magic` URL in Expo Go, `lifecircle://magic` in a build). In demo mode the link is also shown in-app. |
| **Google** | The server verifies real Google ID tokens. The native Google sign-in SDK [isn't available in Expo Go](https://docs.expo.dev/guides/google-authentication/), so in Expo Go a simulated account chooser is used (demo mode only). Real Google sign-in needs a development build (`npx expo run:android` / `eas build`). |

---

## Project layout

```
mobile/                       Expo Go app
  app/                        Expo Router screens (every file is a route)
    index.jsx                 splash → welcome / login / role home
    welcome.jsx               4-slide story: the problem, Planned mode, Urgent mode, privacy
    login.jsx                 one login for every role: Phone OTP · Email link · Google
    onboarding.jsx            new users pick patient family or donor (staff are invite-only)
    magic.jsx                 magic-link deep-link handler
    patient/                  tabs: Overview · Circle · Rotation · Urgent
    donor/                    tabs: Home · Alerts · Profile
    bank/                     tabs: Queue · Daily log · Stock · Donors (+ privacy audit)
    hospital/                 tabs: Patients · Blood stock · Urgent
    notifications.jsx, account.jsx   modals
  components/                 UI kit, Radar, Stock tubes, Countdown ring, Logo, Toasts
  lib/                        API client (finds your laptop's IP), auth/session, theme
backend/app/
  services/eligibility.py     donor medical pre-eligibility
  services/rotation.py        fair rotation with an explainable 0-100 score, forecast
  services/geo.py             haversine + bounding box, rings 5→10→25→50 km
  services/planning.py        core loop: plan → cancel/promote → remind → complete
  services/urgent.py          circle-first escalation, atomic first-accept-wins
  services/inventory.py       stock status, shortage alerts, "rally donors"
  services/privacy.py         what each role may see about a donor
  services/auth_methods.py    OTP, magic link, Google ID-token verification
  security.py                 JWT sessions + require_roles() guard
docs/PRESENTATION.md          problem, impact, algorithms, privacy, scope, demo script
install.bat, api.bat, app.bat  Windows: setup, start API, start app (also test.bat, seed.bat)
Makefile                      macOS/Linux (and Windows with make): install, api, app, test, seed, lint, bundle
```

Checks:

```bash
make test
```

```bash
make lint
```

```bash
make bundle
```

`make test` runs the backend tests (`test.bat` on Windows), `make lint` runs the Expo lint, and `make bundle` compiles the Android bundle without a phone.
