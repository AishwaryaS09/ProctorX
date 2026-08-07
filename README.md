# ProctorX — AI-Powered Online Examination Monitoring

A production-quality, full-stack reimplementation of the legacy Flask proctoring
project. ProctorX splits responsibilities cleanly:

- **React + Vite + Tailwind** frontend (candidate + admin portals)
- **Node.js + Express** backend that owns *all* business logic and MongoDB
- **Python + FastAPI + OpenCV** isolated AI service responsible *only* for vision

The original Flask application in `C:\Users\aishw\Desktop\Infosys` is the
reference implementation. Every feature from that project is preserved and
re-implemented here (see [Feature checklist](#feature-checklist)).

---

## 1. Folder structure

```
PROCTORX/
├── README.md                       # this document
├── docker-compose.yml              # mongodb + ai + backend + frontend
├── backend/                        # Node.js / Express API + business logic
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile
│   ├── uploads/evidence/           # screenshot evidence (gitignored)
│   └── src/
│       ├── server.js               # bootstrap: DB + seed admin + HTTP + sockets
│       ├── app.js                  # express app assembly (helmet, cors, rate limits)
│       ├── config/                 # env.js (lazy env), db.js, constants.js (business rules)
│       ├── models/                 # User, Candidate, Admin, ExamSession,
│       │                           # Violation, FaceEvent, BrowserEvent, AuditLog
│       ├── controllers/            # auth, candidate, exam, monitor, violation,
│       │                           # dashboard, admin
│       ├── routes/                 # one router per domain + health
│       ├── middleware/             # auth (JWT + roles), error, validate, rate-limit, sanitize
│       ├── services/               # auth, trust engine, exam, event, analytics,
│       │                           # report (PDF), audit
│       ├── validators/             # express-validator chains
│       ├── socket/socketServer.js  # Socket.IO live monitoring rooms
│       ├── ai/pythonClient.service.js  # client for the Python AI service
│       ├── scripts/seedAdmin.js    # idempotent admin seeding
│       └── utils/                  # ApiError, ApiResponse, asyncHandler, formatters...
├── python-ai-service/              # FastAPI + OpenCV (AI only)
│   ├── main.py                     # app + CORS + routers
│   ├── config.py                   # lazy runtime config
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── routers/faces.py            # /detect-face, /analyze-frame, /validate-frame
│   ├── services/detector.py        # Haar cascade face detection port
│   ├── utils/decoding.py           # base64 -> BGR frame
│   ├── models/schemas.py           # Pydantic request/response models
│   └── tests/test_faces.py         # pytest suite
├── frontend/                       # React + Vite + Tailwind
│   ├── package.json
│   ├── vite.config.js              # dev proxy /api + /socket.io -> :5000
│   ├── tailwind.config.js
│   ├── index.html
│   ├── Dockerfile + nginx.conf     # static SPA + API proxy
│   ├── .env.example
│   └── src/
│       ├── main.jsx / App.jsx      # providers + route table
│       ├── api/                    # axios instance + domain API modules
│       ├── context/                # AuthContext, ToastContext
│       ├── hooks/                  # useSocket, useDebounce
│       ├── utils/                  # formatters, business constants
│       ├── components/             # layout, common, ui, exam, admin
│       └── pages/                  # Home, Register, Login, Dashboard, Exam,
│                                   # SessionHistory, SessionSummary, Profile,
│                                   # AdminDashboard, AdminSessions, AdminSessionDetail,
│                                   # AdminCandidates, AdminViolations, NotFound
└── docs/                           # reserved for extra documentation
```

---

## 2. Architecture

```
                    ┌────────────────────────────┐
                    │        React SPA           │
                    │  Vite + Tailwind + Router   │
                    └───────┬─────────┬──────────┘
                            │ REST    │ Socket.IO (live)
                            ▼         ▼
                    ┌────────────────────────────┐
                    │     Node.js / Express      │   Auth (JWT), validation,
                    │      (owns ALL logic)      │   rate limiting, business rules,
                    └───────┬─────────┬──────────┘   PDF reports, audit trail
                            │ REST    │
                            ▼         ▼
                   ┌────────────┐   ┌────────────────────────┐
                   │  MongoDB   │   │  Python FastAPI + OpenCV│
                   │  (Mongoose) │   │  AI service (vision only)│
                   └────────────┘   └────────────────────────┘
```

Key rule: **the browser never talks to Python directly.** The request chain is
always `React → Node → Python → Node → MongoDB`.

Data flows:

- **Monitoring loop**: React captures a JPEG webcam frame every ~3s →
  `POST /api/monitor/frame` → Node forwards it to Python `/api/ai/analyze-frame`
  → Node maps the result to a face event and (if suspicious) a violation via the
  trust engine → MongoDB is updated → live updates are pushed over Socket.IO.
- **Browser events**: React reports tab/window/fullscreen changes →
  `POST /api/monitor/browser` → Node classifies them and records violations.
- **Admin view**: Node aggregates analytics from MongoDB; admins watch live
  sessions over Socket.IO (`admins` room).

---

## 3. MongoDB schema

All models live in `backend/src/models/`. Users, Candidates and Admins share
one `users` collection via Mongoose discriminators keyed by `role`.

| Collection | Fields (highlights) | Purpose |
|---|---|---|
| `users` (`User`) | `name`, `email` (unique), `username`, `passwordHash`, `role`, `candidateId`, `phone`, `lastLoginAt`, timestamps | base account |
| `users` (`Candidate`) | discriminator `role: 'candidate'` | candidate accounts |
| `users` (`Admin`) | discriminator `role: 'admin'`, `isSuper` | admin accounts (seeded) |
| `examsessions` | `candidate`, `examName`, `status` (ACTIVE/COMPLETED/ABANDONED), `startTime`, `endTime`, `durationSeconds`, `trustScore`, `currentRisk`, `violationCount`, `warningLevel`, `autoEnded`, `finalRemarks`, `deviceInfo`, timestamps | one doc per monitored exam |
| `violations` | `session`, `candidate`, `type`, `points`, `severity`, `message`, `warningLevel`, `screenshotPath`, `metadata`, timestamps | each trust-penalty event |
| `faceevents` | `session`, `candidate`, `faceStatus`, `faceCount`, `confidence`, `remark`, `screenshotPath`, timestamps | every frame analysis |
| `browserevents` | `session`, `candidate`, `status`, `eventName`, `detail`, `isViolation`, timestamps | every browser event |
| `auditlogs` | `actor`, `action`, `resource`, `resourceId`, `details`, `ip`, timestamps | immutable audit trail |

Indexes are defined for candidate + createdAt, session + createdAt, violation
type/severity, and audit logs by createdAt.

---

## 4. REST API (Node backend)

All responses use a uniform envelope: `{ success, message, data, errors }`.
Protected routes require `Authorization: Bearer <JWT>`.

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register a candidate (name, email, password, confirmPassword, phone?) |
| POST | `/api/auth/login` | — | Login via email or username |
| POST | `/api/auth/logout` | ✅ | Invalidate session (clears cookie, audits) |
| GET | `/api/auth/me` | ✅ | Current user profile |

### Candidate
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/candidate/profile` | ✅ | Get profile |
| PUT | `/api/candidate/profile` | ✅ | Update name / phone |

### Exams
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/exam/start` | ✅ | Start a monitored session (one active at a time) |
| POST | `/api/exam/end/:id` | ✅ | End an active session |
| GET | `/api/exam/active` | ✅ | Current active session |
| GET | `/api/exam/history` | ✅ | Paginated session history |
| GET | `/api/exam/sessions/:id` | ✅ | Session summary (trust, events, violations, remarks) |

### Monitoring
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/monitor/frame` | ✅ | Submit a base64 webcam frame (forwarded to Python AI) |
| POST | `/api/monitor/browser` | ✅ | Submit a browser activity event |
| GET | `/api/monitor/status?sessionId=` | ✅ | Poll live trust/risk/violations |

### Violations / Dashboard
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/violations` | ✅ | Candidate's violations (paginated, filter by type) |
| GET | `/api/dashboard` | ✅ | Candidate dashboard stats |

### Admin (role: admin)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/dashboard` | admin | KPIs + live sessions |
| GET | `/api/admin/analytics` | admin | Violations by type, 7-day trend, face/browser split |
| GET | `/api/admin/sessions` | admin | Sessions with status/search/sort + pagination |
| GET | `/api/admin/sessions/:id` | admin | Full session detail (events, violations, warnings) |
| GET | `/api/admin/sessions/:id/report` | admin | PDF session report |
| GET | `/api/admin/candidates` | admin | Candidates with search + pagination |
| GET | `/api/admin/violations` | admin | Violations with type/severity filters |
| GET | `/api/admin/audit-logs` | admin | Audit trail (paginated) |

### Health
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | — | Backend health |

---

## 5. Python AI service API

Base URL `http://localhost:8000`. Only the Node backend calls it.

| Method | Route | Request | Response |
|---|---|---|---|
| POST | `/api/ai/detect-face` | `{ "image": "<base64|dataURL>" }` | `{ faceStatus, faceCount, confidence, multipleFaces, lookingAway, remark }` |
| POST | `/api/ai/analyze-frame` | `{ "image": "..." }` | same as detect-face (used by the monitor loop) |
| POST | `/api/ai/validate-frame` | `{ "image": "..." }` | `{ ok, message, width, height, channels, bytes_ }` |
| GET | `/health` | — | `{ service, status }` |

`faceStatus` is one of `PRESENT | ABSENT | MULTIPLE | LOOKING_AWAY | ERROR`.
Interactive docs are available at `/docs` (Swagger UI).

---

## 6. Environment variables

### Backend (`backend/.env`) — see `.env.example`
| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | runtime mode |
| `PORT` | `5000` | HTTP port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/proctorx` | MongoDB connection |
| `JWT_SECRET` | insecure default | signing key (set a strong value!) |
| `JWT_EXPIRES_IN` | `8h` | token lifetime |
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` | Python service base URL |
| `AI_SERVICE_TIMEOUT_MS` | `5000` | AI call timeout |
| `ADMIN_USERNAME/ADMIN_PASSWORD/...` | — | seeded admin account |
| `CLIENT_URL` | `http://127.0.0.1:5173` | CORS + socket origin |
| `SCREENSHOT_ENABLED` | `true` | evidence capture |
| `WARNING_LEVELS` | `1,2,3` | warning thresholds |
| `AUTO_END_THRESHOLD` | `5` | auto-end threshold |
| `SCREENSHOT_SEVERITY_BELOW` | `MEDIUM` | screenshot from this severity up |

### Frontend (`frontend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | API base (proxied in dev) |
| `VITE_WS_URL` | empty | Socket.IO URL (uses same origin in dev) |

### Python service — prefix `AI_*` (optional)
`AI_PORT`, `AI_HOST`, `AI_MAX_IMAGE_BYTES`, `AI_CORS_ORIGINS`,
`AI_SCALE_FACTOR`, `AI_MIN_NEIGHBORS`, `AI_MIN_FACE_SIZE`,
`AI_LOOK_AWAY_X_THRESHOLD`, `AI_LOOK_AWAY_Y_THRESHOLD`.

---

## 7. Installation

Prerequisites: Node.js ≥ 18 (tested on 25.x), npm, Python 3.11, MongoDB.

```bash
# 1. Backend
cd PROCTORX/backend
npm install
cp .env.example .env            # edit secrets + MONGO_URI

# 2. Python AI service
cd PROCTORX/python-ai-service
python -m venv venv
venv\Scripts\activate           # Windows (or source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# 3. Frontend
cd PROCTORX/frontend
npm install
cp .env.example .env
```

---

## 8. Startup

```bash
# Terminal 1 — Python AI service
cd PROCTORX/python-ai-service
venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000
# health: http://127.0.0.1:8000/health

# Terminal 2 — Node backend (needs MongoDB running)
cd PROCTORX/backend
npm start                       # seeds admin, connects MongoDB, starts :5000
# health: http://127.0.0.1:5000/healthz

# Terminal 3 — Frontend
cd PROCTORX/frontend
npm run dev                     # http://127.0.0.1:5173

# Tests
python -m pytest tests -q       # python-ai-service, from its folder
npm run check                   # backend syntax smoke check

# Docker (optional, runs everything incl. MongoDB)
cd PROCTORX
docker-compose up --build
```

---

## 9. MongoDB configuration

- **Local**: install MongoDB Community Server, start the service, default
  connection is `mongodb://127.0.0.1:27017/proctorx` — no config needed.
- **Docker**: `docker-compose up mongodb` (or the whole stack).
- **Atlas**: create a free cluster, copy the connection string into
  `backend/.env` as `MONGO_URI`, and whitelist your IP.
- On first backend start the default admin is seeded automatically
  (`ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`).
- Optionally run `npm run seed` inside `backend/` to re-ensure the admin.

---

## 10. E2E testing guide

1. Start all three services (Section 8).
2. Register a candidate, then log in.
3. Start an exam and allow camera + fullscreen.
4. Perform the monitored behaviors below while watching the monitor screen and
   `db.getCollection('violations').find()` in MongoDB.
5. End the session, open the summary, then open the admin console and check
   sessions / violations / PDF report.

Suggested SQLite-free DB checks in MongoDB shell:

```js
use proctorx
db.users.find({}, {name:1, role:1, candidateId:1})
db.examsessions.find({}, {examName:1, trustScore:1, status:1})
db.violations.find({}, {type:1, points:1, severity:1})
db.auditlogs.find({}, {action:1, actorName:1})
```

---

## 11. Feature checklist (vs. reference project)

- [x] Candidate registration with duplicate-email protection and password hashing
- [x] Login/logout, JWT with roles, protected candidate + admin routes
- [x] Exam session start/end, one active session per candidate
- [x] Camera permission gate + consent screen before monitoring
- [x] Live face monitoring every ~3s: PRESENT / ABSENT / MULTIPLE / LOOKING_AWAY / ERROR
- [x] Look-away thresholds (X/Y 0.35) ported from reference config
- [x] Browser monitoring: tab switch, window blur, minimize, fullscreen exit, inactivity
- [x] Trust score (starts 100, floor 0) and risk bands LOW ≥85 / MEDIUM ≥60 / HIGH ≥35 / CRITICAL <35
- [x] Violation points table identical to reference (see Section 12)
- [x] Warnings at violation counts 1, 2, 3 with candidate-facing messages
- [x] Auto-end at 5 violations with final remarks + redirect to summary
- [x] Screenshot evidence for violations ≥ MEDIUM severity
- [x] Event timeline (face + browser + violations) on the monitor screen
- [x] Session summary with generated remarks (ported from reference logic)
- [x] Session history with pagination
- [x] Admin dashboard: KPIs, live sessions, violation analytics, 7-day trend, face/browser split
- [x] Admin session detail with violations/warnings/face/browser tabs
- [x] Admin candidates + violations pages with search/filter/pagination
- [x] PDF session report (admin)
- [x] Audit log for auth/session/report actions
- [x] Production polish: toasts, skeletons, empty states, 404, error handling
- [x] Security: helmet, rate limiting, input validation + sanitization, bcrypt, JWT expiry
- [x] Docker support (compose stack)

---

## 12. Business rules (single source of truth: `backend/src/config/constants.js`)

| Violation | Points | Severity |
|---|---|---|
| `MULTIPLE_FACES` | 10 | HIGH |
| `TAB_CHANGED` | 10 | HIGH |
| `FULLSCREEN_EXIT` | 8 | HIGH |
| `FACE_ABSENT` | 5 | MEDIUM |
| `WINDOW_UNFOCUSED` | 5 | MEDIUM |
| `BROWSER_INACTIVE` | 5 | MEDIUM |
| `BROWSER_MINIMIZED` | 5 | MEDIUM |
| `LOOKING_AWAY` | 3 | LOW |

---

## 13. Known limitations

- Haar-cascade face detection (ported from the reference) can mis-classify on
  poor lighting/angles; a DNN model is a future improvement.
- MongoDB must be reachable; the backend fails fast if it cannot connect.
- Frames are base64 JPEGs over HTTP — fine for a demo, heavier than WebRTC or
  multipart streaming at scale.
- Evidence screenshots are stored on the backend filesystem (path stored in
  MongoDB); GridFS would be more portable.
- Admin reports download via the browser; no report history is kept.
- Candidate "minimized" detection relies on window/visibility heuristics and is
  best-effort.

---

## 14. Future improvements

- Replace Haar cascade with a deep-learning detector (MediaPipe / DNN)
  for higher accuracy.
- Stream frames over WebRTC or binary WebSocket instead of base64 JSON.
- Store evidence in GridFS and generate reports server-side on a schedule.
- Add email verification and password reset flows.
- Add proctor-in-the-loop: human approval and live chat.
- Add exam scheduling, question banks and per-question analytics.
- Rate-limit tuning and multi-region deployment via containers.
- Add CI: backend API tests (supertest + mongodb-memory-server), frontend
  component tests (Vitest + Testing Library), Python pytest in a pipeline.

---

## 15. Testing checklist (18 verifications)

1. **Registration** — register with a new email → success toast, redirected to dashboard.
2. **Duplicate registration** — same email again → 409, error toast shown.
3. **Validation** — short password / mismatched confirm → field errors, no request sent twice.
4. **Login (candidate)** — correct email+password → dashboard; wrong password → 401.
5. **Login (admin)** — `ADMIN_USERNAME`/`ADMIN_PASSWORD` → admin overview.
6. **Protected routes** — hitting `/dashboard` logged out redirects to `/login`.
7. **JWT expiry** — manually invalidate/expire token → 401 and redirect to login.
8. **Camera permission** — deny camera → clear error message on consent screen.
9. **Start exam** — session appears active; second start is blocked (409).
10. **Face present** — camera on you → face status PRESENT, no violations.
11. **Face absent / looking away** — leave frame / turn head → violation, trust drops, warning banner at count 1.
12. **Tab switch / fullscreen exit / window blur** — each triggers the matching violation (points table above).
13. **Trust/risk math** — e.g. one `TAB_CHANGED` (10pts) → trust 90, risk LOW; verify in MongoDB.
14. **Auto-end** — reach 5 violations → session COMPLETED, autoEnded=true, final remarks set, redirect to summary.
15. **Session summary** — trust meter, counts, remarks, violation table render correctly.
16. **Admin flows** — live sessions update on socket; search/filter/pagination work; PDF report downloads.
17. **Audit trail** — `auditlogs` shows LOGIN, SESSION_STARTED, SESSION_ENDED, REPORT_DOWNLOADED.
18. **Error/edge cases** — 404 route, malformed frame payload (422), AI service stopped (frame returns `aiUnavailable`, app keeps running), DB down (backend fails fast with a clear log).

---

## Reference mapping

The original Flask project at `C:\Users\aishw\Desktop\Infosys` remains the
behavioural specification:

| Reference | ProctorX |
|---|---|
| `config.py` | `backend/src/config/constants.js`, `python-ai-service/config.py` |
| `services/trust_service.py` | `backend/src/services/trust.service.js` |
| `services/session_service.py` | `backend/src/services/exam.service.js` |
| `services/face_detection.py` | `python-ai-service/services/detector.py` |
| `routes/api.py` | `backend/src/routes/*` + `controllers/*` |
| `templates/*` + `static/js/*` | `frontend/src/pages/*` + `components/*` |
| SQLite tables | MongoDB collections (Section 3) |
