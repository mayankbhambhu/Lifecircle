# LifeCircle: capstone presentation notes

The app runs on a phone in **Expo Go** (React Native, Expo SDK 58) and talks to the FastAPI backend over Wi-Fi. See the README for setup.

## 1. The real problem, and why it matters

A child with **thalassemia major** needs a red-cell transfusion every **2–4 weeks for life**. In India, most of these patients depend on *replacement donors* that their own family arranges, so every cycle starts the same scramble again:

| Pain today | What it causes |
|---|---|
| Parents message relatives and friends manually every cycle | The same 2–3 people are asked again and again, burn out, and stop answering |
| Donors don't track the 90-day (men) / 120-day (women) gap | Willing donors turn up ineligible, or are asked too soon |
| Cancellations happen the night before | A routine transfusion becomes an emergency, and the family scrambles on social media |
| Blood banks only learn about shortages at the counter | Rare groups (O-, AB-, B-) run out with no warning |

**Who benefits**

* **Families** get one calm dashboard: next date, who is confirmed, who is the backup, and one button for help.
* **Donors** are asked fairly, reminded on time, and contacted only when they are actually eligible.
* **Blood banks** get a single queue, a screening log, and early stock warnings with a "rally donors" action.
* **Hospitals** can see which patients are covered for their next transfusion, and which are not.

## 2. The two core mechanics

### Planned mode (the core loop)

```
transfusion completed
   └─► next date = last + cycle_days            (scheduler.next_transfusion_date)
        └─► eligibility check for the whole circle on that date
             └─► fair rotation → CONFIRMED + BACKUP     (rotation.rank_circle)
                  └─► blood bank approves the slot      (bank queue)
                       └─► reminders T-7, T-3, T-1 (backup on standby at T-3)
                            └─► staff log: Donated / Deferred / No-show / Excused
                                 └─► "Transfusion done" → plans the next cycle  ↺
```

Self-healing rules:

* The confirmed donor cancels, is **deferred** at screening, or is a **no-show** → the backup is promoted, and a new backup is picked by rotation.
* There is no backup → **Urgent mode** starts automatically.
* At T-3 there is still no confirmed donor → Urgent mode starts automatically.
* At T-1 the confirmed donor never replied but the backup confirmed → the two are swapped.

### Urgent mode (the emergency flow)

1. The request goes to the **blood bank queue** at once.
2. **Stage 1, circle:** every eligible member of the patient's own circle is alerted.
3. **Stage 2 onwards, broadcast:** verified, available, compatible, eligible donors *outside* the circle are alerted ring by ring: **5 → 10 → 25 → 50 km**, closest first, at most 10 per ring. A ring widens when its timer expires, when every donor in it declines, or when staff press *Widen radius*.
4. Each donor sees "**2.4 km from you**". **The first donor to accept is confirmed.** This uses a single conditional `UPDATE … WHERE status IN ('circle','broadcast')`, so two simultaneous taps can never both win.
5. Staff can **broadcast now**, **re-route** to another bank, or **fulfil from stock** at any point.

Conflict guard: a donor who is the *confirmed* donor for another patient within their donation gap is never pulled into an emergency, because that would only move the crisis to the other family. Backups *can* be pulled in, and their backup slot is refilled automatically.

## 3. The algorithms (the code to show)

### Eligibility: `services/eligibility.py`
A pure function that returns **every** failing reason plus the earliest date the time-based blockers clear:

| Rule | Default |
|---|---|
| Age | 18–65 |
| Weight | ≥ 45 kg |
| Whole-blood gap | 90 days (men) / 120 days (women) |
| Temporary deferral | until `deferred_until` |
| Compatibility | ABO + RhD red-cell rules |
| Haemoglobin | ≥ 12.5 g/dL, checked at **final screening** (a lower Hb cannot be logged as *Donated*) |

All thresholds live in one `Rules` object, so a blood bank can tune them.

### Fair rotation: `services/rotation.py`
Hard filter: medical eligibility. Each eligible donor then gets a transparent **0–100 score**:

| Component | Weight | Meaning |
|---|---|---|
| Rotation | 40 | Days since this donor last served *this patient* (never = full credit, ≥ 180 days = full) |
| Rest | 20 | Rest beyond their mandatory gap |
| Reliability | 20 | Laplace-smoothed show-up rate (new donors start at 0.5), minus recent cancellations and no-shows |
| Load | 15 | Fewer donations in the last 365 days (a fatigue guard) |
| Exact match | 5 | Same ABO/Rh preferred for chronic transfusion (reduces alloimmunisation) |

The top score becomes the confirmed donor and the runner-up the backup. Ties break on longest-since-served, then donor id, so the result is deterministic. `forecast()` simulates the next N cycles. In the demo, Aarav's 6-cycle forecast rotates through **Amit → Priya → Sneha → Rahul → Deepak → Vikram**: nobody is asked twice before everyone has been asked once (a unit test checks this).

### Geospatial ranking: `services/geo.py`
* `bounding_box()` pre-filters in SQL on an indexable lat/lng range. This maps 1:1 onto PostGIS `ST_DWithin` at scale.
* `haversine_km()` then gives the exact great-circle distance.
* Results are sorted by distance, then by exact blood-group match, then by id.

### Stock alerts: `services/inventory.py`
`critical` = units ≤ 50% of the minimum **or** < 2 days of cover. `low` = below the minimum **or** < 5 days of cover.
Alerts fire **once, on a transition** (healthy→low→critical), to blood bank staff and linked hospitals. *Rally donors* notifies verified, currently-eligible donors of that exact group within 15 km of the bank. It is rate-limited to once per 24 h per group so donors aren't spammed.
The loop is closed both ways: logging *Donated* adds +1 unit, and completing a transfusion or fulfilling an urgent request from stock removes units.

## 4. Login and role-based access

**One common login page** offers three passwordless methods:

| Method | Security details |
|---|---|
| Phone **OTP** | 6 digits, HMAC-SHA256 hashed at rest, 5-minute expiry, 5 attempts, 30 s resend cooldown, single use |
| Email **magic link** | 256-bit random token, hashed at rest, 15-minute expiry, single use. The link opens the app (`lifecircle://magic`, or `exp://…/--/magic` in Expo Go). The server only accepts the app's own schemes as link targets, so nobody can redirect a sign-in link to their own website |
| **Google** | ID token verified with Google (`aud` must be one of our client ids, the email must be verified). An existing email account is linked automatically. The native Google SDK isn't part of Expo Go, so the demo uses a simulated chooser; a development build uses the real one |

Every method ends the same way. A known user gets a JWT, kept in the phone's secure keychain (expo-secure-store), and the app opens that role's tab set: `/patient`, `/donor`, `/bank` or `/hospital`. Each tab group has a role guard, so a donor can't navigate into the blood bank tabs. A new identity gets a 30-minute *onboarding token* and picks **Patient family** or **Donor**. **Blood bank and hospital accounts are invite-only**, so nobody can self-register into a role that sees phone numbers.

Every route uses `Depends(require_roles(...))`, and every resource is checked for ownership. A family can only see its own patients, staff only their own bank's requests, and a donor only their own slots and alerts. Requests for another user's records return **404**, not 403, so the API doesn't even confirm that the record exists.

## 5. Privacy routing

All donor data passes through one function, `privacy.donor_card(donor, viewer)`:

| Field | Family | Hospital | Blood bank | Donor (self) |
|---|:-:|:-:|:-:|:-:|
| Short name ("Amit S.") | ✓ | ✓ | ✓ | ✓ |
| Full name, age, weight | – | – | ✓ | ✓ |
| **Phone number** | – | – | ✓ | ✓ |
| Medical deferral reasons | – (only "Resting until 3 Jan") | – | ✓ | ✓ |
| Patient name in an urgent alert | n/a | n/a | ✓ | only if the donor is in that patient's circle |

* The phone field is **omitted**, not masked, so it never reaches the family's or hospital's phone at all, not even in the raw network response. A test scans the entire family and hospital API responses for every donor phone number.
* Each staff view of contact details writes a row to the **privacy audit log**, which is visible in the blood bank's dashboard.

## 6. What this doesn't do (scope)

* **It is not a medical device.** Eligibility is a *pre-screen*. The final decision is the blood bank's screening on the day.
* No cross-matching, no extended phenotype matching (Rh C/c/E/e, Kell) and no iron-chelation or ferritin tracking.
* It does not replace the blood bank's LIS or inventory system. Stock levels are entered by staff (an integration point).
* There is no real SMS, WhatsApp or e-mail gateway in the demo. OTPs and links show up in a "demo inbox". `ConsoleSender` is the plug-in point.
* There are no OS push notifications. Expo Go no longer supports remote push on Android, so the app polls for in-app alerts every 12 s and shows them as banners with haptics. A development build with expo-notifications is the production path.
* Real Google sign-in needs a development build, because Expo Go can't load the native Google SDK.
* Distances are straight-line, not travel time. There is no live traffic or routing.
* There is no transport booking, payment, or movement of blood between cities.
* Staff accounts are seeded. Admin tools for inviting staff are out of scope.
* Background jobs run in-process (every 60 s). At scale they would move to a worker queue.

## 7. A 5-minute demo script (on a phone in Expo Go)

1. **Welcome slides**: the problem, Planned mode, Urgent mode, and privacy. Swipe through them, or tap Skip.
2. **Login → Patient family (Neha)**: the next transfusion is **in 9 days**, shown with a countdown ring. Amit is *confirmed* and Priya is the *backup*. Open **Rotation** to show the fair 6-cycle forecast and the scoring weights. Open **Circle** to show eligibility labels with no phone numbers anywhere. You can share the invite code with the native share sheet.
3. **Avatar → Sign out → Donor (Priya)**: a red banner shows an urgent request **2.4 km from you**. Open **Alerts** and tap **I can donate**. She wins, and you feel the haptic.
4. **Blood bank (Dr. Meera)**:
   * In the **Queue**, Ishaan's request is *Filled*. The radar shows who was alerted and at what distance; tap a phone number to call. Aarav's backup slot was released automatically, because Priya donated elsewhere.
   * In the **Daily log**, enter Hb 13.4 for Ayesha and tap **Donated**. Stock goes up by one.
   * Back in the **Queue**, tap **Transfusion done** on Zoya. The next cycle is planned instantly, with the next donor picked by rotation.
   * In **Stock**, O- and AB- are critical. Tap **Rally** to see who was notified.
   * In **Donors**, tap the audit icon: every contact view is logged.
5. **Hospital (Ravi)**: patient coverage, the stock shortage banner, and **Urgent request**.
6. Show the login methods: **Phone OTP** (the code arrives as a demo SMS), **Email** (a link that opens the app), and **Google**. Then onboarding, where the staff roles are invite-only.

## 8. Running the tests

```bash
cd backend && python -m pytest -q      # 40 passed
```
