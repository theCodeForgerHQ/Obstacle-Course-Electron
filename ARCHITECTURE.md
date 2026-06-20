# Obstacle Course — Architecture

> Auto-derived from the graphify knowledge graph (`graphify-out/`) + repo inspection.
> Vectorless knowledge DB: `graphify-out/graph.json` · Interactive map: `graphify-out/graph.html`

An **Electron desktop app** (React + TypeScript + Vite + SQLite) that runs an obstacle-course / leaderboard system, paired with an **RFID-over-CAN hardware bridge** (`usb-can/`) that streams tag scans from ESP32 readers into the app.

---

## System at a glance

```
                 ┌──────────────────────────────────────────────┐
                 │            Electron App (desktop)             │
                 │                                              │
   RFID tag ──▶  │  React UI  ◀──IPC(preload)──▶  Electron Main  │
                 │  (renderer)                    (node + SQLite)│
                 └──────────────────────────────────────────────┘
                                  ▲
                                  │ events.jsonl / serial
                 ┌────────────────┴───────────────┐
                 │   usb-can/  (RFID-over-CAN)     │
                 │  ESP32 reader → CAN bus →        │
                 │  Waveshare USB-CAN-A → read.mjs  │
                 └─────────────────────────────────┘
```

Three top-level domains map directly onto the three biggest graph communities:

| Domain | Source | Graph community |
|--------|--------|-----------------|
| Electron backend (DB + auth + IPC) | `src/electron/` | *Electron DB & Auth Utilities*, *Electron Window Bootstrap*, *Electron Preload* |
| React frontend (pages + UI kit) | `src/react/` | *Customer/User Directory*, *Leaderboard*, *Dashboard*, *Profile Settings*, UI components, *Frontend Stack* |
| RFID hardware bridge | `usb-can/` | *USB-CAN RFID Firmware & Protocol* |

---

## File architecture

```
obstacle-course/
├── src/
│   ├── electron/                 # Electron main process (Node side)
│   │   ├── main.ts               # App entry: createWindow(), IPC registration, safeHandler()
│   │   ├── preload.ts            # contextBridge — the only renderer↔main surface
│   │   └── utils.ts              # SQLite DB + auth: users, customers, sessions, scores
│   │
│   └── react/                    # Renderer (Vite + React + TS)
│       ├── main.tsx              # React root mount
│       ├── App.tsx               # Top-level shell + onLogin routing
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Leaderboard.tsx       # ranks scores, calculateAge(), withinRange()
│       │   ├── CustomerDirectory.tsx # CRUD customers + scores modal
│       │   ├── UserDirectory.tsx     # CRUD users, promote/demote operator
│       │   └── ProfileSettings.tsx
│       ├── components/ui/        # shadcn-style Radix primitives
│       │   ├── button.tsx  dialog.tsx  input.tsx  select.tsx
│       ├── lib/
│       │   └── utils.ts          # cn() class-merge (clsx + tailwind-merge)
│       └── assets/               # rank_1/2/3.png badges, react/vite logos
│
├── usb-can/                      # RFID-over-CAN hardware bridge (standalone)
│   ├── firmware/
│   │   ├── reader_pro/           # production ESP32 firmware (canRecover() self-heal)
│   │   └── reader_original/      # earlier reference firmware
│   ├── waveshare.mjs             # Waveshare USB-CAN-A binary protocol codec
│   ├── read.mjs                  # receive-only CLI → events.jsonl (laptop-side timestamping)
│   ├── selftest.mjs              # protocol checks
│   ├── loopback.mjs              # controller self-test
│   ├── ports.mjs / list-ports.mjs# serial port discovery
│   ├── README.md                 # protocol + wiring reference
│   └── DEBUG-LOG.md              # hard-won hardware rationale (flash dance, half-duplex…)
│
├── dist-electron/ dist-react/    # build output (transpiled / bundled — derived, not source)
│
└── config
    ├── package.json              # name: obstacle-course · main: dist-electron/main.js
    ├── electron-builder.json     # packaging (dist:mac/win/linux)
    ├── vite.config.ts
    ├── tsconfig*.json            # app / node split
    ├── tailwind.config.js  postcss.config.js
    ├── eslint.config.js          # type-aware ESLint
    └── types.d.ts                # window.electron IPC type surface
```

---

## Layer responsibilities

### 1. Electron main (`src/electron/`)
The privileged Node process. `utils.ts` is the **data + auth core**: `initDb()`,
`hashPassword()` (bcrypt), session lifecycle (`createSession` / `readSession` / `eraseSession`),
and CRUD for users, customers, and scores via a `buildSetClause()` query helper.
`main.ts` builds the window and wraps every IPC handler in `safeHandler()`.
`discoverEsps()` finds connected readers. **`readSession()` is a god node** (15 edges) —
the auth gate most operations route through.

### 2. Renderer (`src/react/`)
Pure UI. Talks to main **only** through the `window.electron` bridge defined in
`preload.ts` and typed in `types.d.ts` — no direct DB/Node access. Pages are
container components (data load + handlers); `components/ui/` are presentational
Radix primitives styled with Tailwind via `cn()`.

### 3. RFID bridge (`usb-can/`)
Independent Node + Arduino subsystem. ESP32 readers pack a tag UID into a 5-byte
CAN frame (8-byte limit) at 500 kbit/s; the **Waveshare USB-CAN-A is half-duplex**,
so the laptop runs **receive-only** and stamps wall-clock time itself (ESP32 has no
RTC). `read.mjs` writes `events.jsonl`. See `DEBUG-LOG.md` for the design rationale
the graph surfaced as `rationale_for` edges.

---

## Critical data flows (from graph hyperedges)

1. **RFID-over-CAN end-to-end** — `reader (ESP32)` → `CAN bus` → `Waveshare module` → `read.mjs` → laptop record *(EXTRACTED 0.95)*
2. **Scan frame encoding** — `scan frame` + `UID packing` + `READER_NUM` + `reader_ms` field *(0.90)*
3. **Half-duplex drives receive-only + laptop timing** — `half_duplex` + `receive_only rationale` + `laptop_stamp rationale` + `time_handling` *(0.85)*

---

## Knowledge graph index

| Output | Path | Use |
|--------|------|-----|
| Vectorless DB | `graphify-out/graph.json` | GraphRAG / programmatic queries |
| Interactive map | `graphify-out/graph.html` | Browse communities visually |
| Audit report | `graphify-out/GRAPH_REPORT.md` | God nodes, surprises, gaps |
| Per-file cache | `graphify-out/cache/` | Incremental re-index |

**Re-index after changes:** `/graphify . --update` (code-only changes skip the LLM).

> Note: ~30 of the 45 communities are minified function clusters from the committed
> `dist-react` bundle — build output, not authored source. The meaningful architecture
> lives in `src/` and `usb-can/`.
