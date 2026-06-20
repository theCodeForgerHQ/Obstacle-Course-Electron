# Graph Report - .  (2026-06-19)

## Corpus Check
- 32 files · ~208,579 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 336 nodes · 673 edges · 45 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Minified Bundle Internals|Minified Bundle Internals]]
- [[_COMMUNITY_Minified Bundle Entry|Minified Bundle Entry]]
- [[_COMMUNITY_USB-CAN RFID Firmware & Protocol|USB-CAN RFID Firmware & Protocol]]
- [[_COMMUNITY_Electron DB & Auth Utilities|Electron DB & Auth Utilities]]
- [[_COMMUNITY_Minified React Internals|Minified React Internals]]
- [[_COMMUNITY_Minified React Runtime|Minified React Runtime]]
- [[_COMMUNITY_Customer Directory Page|Customer Directory Page]]
- [[_COMMUNITY_Minified Bundle (misc)|Minified Bundle (misc)]]
- [[_COMMUNITY_User Directory Page|User Directory Page]]
- [[_COMMUNITY_Rank Badges & Gamification|Rank Badges & Gamification]]
- [[_COMMUNITY_Minified Bundle (C10)|Minified Bundle (C10)]]
- [[_COMMUNITY_Minified Bundle (C11)|Minified Bundle (C11)]]
- [[_COMMUNITY_Minified Bundle (C12)|Minified Bundle (C12)]]
- [[_COMMUNITY_Rank 2 Silver Badge|Rank 2 Silver Badge]]
- [[_COMMUNITY_Minified Bundle (C14)|Minified Bundle (C14)]]
- [[_COMMUNITY_Minified Bundle (C15)|Minified Bundle (C15)]]
- [[_COMMUNITY_Vite Template Docs|Vite Template Docs]]
- [[_COMMUNITY_Frontend Stack (React+Vite)|Frontend Stack (React+Vite)]]
- [[_COMMUNITY_Electron Window Bootstrap|Electron Window Bootstrap]]
- [[_COMMUNITY_Minified Bundle (C19)|Minified Bundle (C19)]]
- [[_COMMUNITY_Minified Bundle (C20)|Minified Bundle (C20)]]
- [[_COMMUNITY_React App Root|React App Root]]
- [[_COMMUNITY_Minified Bundle (C22)|Minified Bundle (C22)]]
- [[_COMMUNITY_Minified Bundle (C23)|Minified Bundle (C23)]]
- [[_COMMUNITY_Leaderboard Page|Leaderboard Page]]
- [[_COMMUNITY_Minified Bundle (C25)|Minified Bundle (C25)]]
- [[_COMMUNITY_Minified Bundle (C26)|Minified Bundle (C26)]]
- [[_COMMUNITY_Minified Bundle (C27)|Minified Bundle (C27)]]
- [[_COMMUNITY_Minified Bundle (C28)|Minified Bundle (C28)]]
- [[_COMMUNITY_Minified Bundle (C29)|Minified Bundle (C29)]]
- [[_COMMUNITY_Minified Bundle (C30)|Minified Bundle (C30)]]
- [[_COMMUNITY_cn() Class-merge Utility|cn() Class-merge Utility]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Profile Settings Page|Profile Settings Page]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Type Definitions|Type Definitions]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Electron Preload (built)|Electron Preload (built)]]
- [[_COMMUNITY_Electron Preload (source)|Electron Preload (source)]]
- [[_COMMUNITY_Dialog UI Component|Dialog UI Component]]
- [[_COMMUNITY_Button UI Component|Button UI Component]]
- [[_COMMUNITY_Select UI Component|Select UI Component]]
- [[_COMMUNITY_Input UI Component|Input UI Component]]

## God Nodes (most connected - your core abstractions)
1. `vx()` - 17 edges
2. `Ml()` - 16 edges
3. `readSession()` - 15 edges
4. `Pt()` - 14 edges
5. `yb()` - 13 edges
6. `ne()` - 13 edges
7. `Ut()` - 13 edges
8. `zg()` - 12 edges
9. `un()` - 12 edges
10. `uE()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `FTDI Board, No Auto-reset (BOOT/EN flash dance)` --references--> `Reader (ESP32 + 125 kHz RFID + CAN)`  [EXTRACTED]
  usb-can/DEBUG-LOG.md → usb-can/README.md
- `CAN Pins GPIO16 TX / GPIO17 RX` --references--> `Reader (ESP32 + 125 kHz RFID + CAN)`  [EXTRACTED]
  usb-can/DEBUG-LOG.md → usb-can/README.md
- `Half-duplex Limitation of USB-CAN-A` --references--> `Waveshare USB-CAN-A Module`  [EXTRACTED]
  usb-can/DEBUG-LOG.md → usb-can/README.md
- `Rationale: laptop is receive-only (no TX)` --rationale_for--> `read.mjs (Receiver CLI)`  [EXTRACTED]
  usb-can/DEBUG-LOG.md → usb-can/README.md
- `canRecover() Bus-off Self-heal` --references--> `firmware/reader_pro`  [EXTRACTED]
  usb-can/DEBUG-LOG.md → usb-can/README.md

## Hyperedges (group relationships)
- **RFID-over-CAN End-to-End Data Flow** — usbcan_reader_esp32, usbcan_can_bus, usbcan_waveshare_module, usbcan_read_mjs, usbcan_laptop_record [EXTRACTED 0.95]
- **Scan Frame Encoding Scheme** — usbcan_scan_frame, usbcan_uid_packing, usbcan_reader_num, dbg_reader_ms_field [EXTRACTED 0.90]
- **Half-duplex Module Drives Receive-only + Laptop Timing** — dbg_half_duplex, dbg_rationale_receive_only, dbg_rationale_laptop_stamp, dbg_time_handling [EXTRACTED 0.85]

## Communities

### Community 0 - "Minified Bundle Internals"
Cohesion: 0.13
Nodes (46): Ae(), cE(), cn(), Da(), Fe(), Ft(), gE(), Gg() (+38 more)

### Community 1 - "Minified Bundle Entry"
Cohesion: 0.05
Nodes (4): ix(), kg(), mp(), px()

### Community 2 - "USB-CAN RFID Firmware & Protocol"
Cohesion: 0.07
Nodes (33): Adding More Readers (unique READER_NUM), arduino-cli Build (esp32 core 3.3.10, NeoPixel), CAN Pins GPIO16 TX / GPIO17 RX, canRecover() Bus-off Self-heal, FTDI Board, No Auto-reset (BOOT/EN flash dance), Half-duplex Limitation of USB-CAN-A, Rationale: laptop-side stamping (ESP32 no RTC + half-duplex), Rationale: receiver must run normal mode to ACK (+25 more)

### Community 3 - "Electron DB & Auth Utilities"
Cohesion: 0.2
Nodes (27): buildSetClause(), createCustomer(), createSession(), createUser(), deleteCustomer(), deleteUser(), demoteUserToOperator(), discoverEsps() (+19 more)

### Community 4 - "Minified React Internals"
Cohesion: 0.1
Nodes (27): _b(), ba(), Bp(), Cs(), db(), Es(), gb(), Gp() (+19 more)

### Community 5 - "Minified React Runtime"
Cohesion: 0.16
Nodes (19): _a(), b1(), bc(), Bs(), Cp(), Dn(), H(), Hg() (+11 more)

### Community 6 - "Customer Directory Page"
Cohesion: 0.21
Nodes (4): closeForm(), handleDelete(), handleSubmit(), refreshCustomers()

### Community 7 - "Minified Bundle (misc)"
Cohesion: 0.2
Nodes (11): DE(), _E(), HE(), J(), lt(), mE(), OE(), sE() (+3 more)

### Community 8 - "User Directory Page"
Cohesion: 0.33
Nodes (7): closeForm(), handleDelete(), handleDemote(), handlePromote(), handleSubmit(), init(), refreshUsers()

### Community 9 - "Rank Badges & Gamification"
Cohesion: 0.22
Nodes (9): Achievement / Reward, First Place / Top Rank, Gamification, Leaderboard Ranking, Rank / Achievement System, Reward / Gamification UI, Third Place, Rank 1 Badge (+1 more)

### Community 10 - "Minified Bundle (C10)"
Cohesion: 0.29
Nodes (7): E1(), Ec(), eg(), kx(), sp(), sx(), v1()

### Community 11 - "Minified Bundle (C11)"
Cohesion: 0.33
Nodes (6): fx(), ip(), Oa(), Rl(), tc(), ux()

### Community 12 - "Minified Bundle (C12)"
Cohesion: 0.33
Nodes (6): dx(), hx(), mx(), Oi(), op(), Ra()

### Community 13 - "Rank 2 Silver Badge"
Cohesion: 0.4
Nodes (6): Achievement / Award Badge, Crown and Laurel Wreath, Leaderboard Ranking, Second Place / Rank 2, Silver Tier, Rank 2 Badge

### Community 14 - "Minified Bundle (C14)"
Cohesion: 0.4
Nodes (5): bb(), jb(), kb(), Xb(), Zb()

### Community 15 - "Minified Bundle (C15)"
Cohesion: 0.4
Nodes (5): Bx(), gx(), _l(), Mv(), xx()

### Community 16 - "Vite Template Docs"
Cohesion: 0.5
Nodes (5): Type-aware ESLint Configuration, React Compiler, React + TypeScript + Vite Template, @vitejs/plugin-react (Babel Fast Refresh), @vitejs/plugin-react-swc (SWC Fast Refresh)

### Community 17 - "Frontend Stack (React+Vite)"
Cohesion: 0.5
Nodes (5): Frontend Stack, React (UI Library), React Logo, Vite Logo, Vite (Build Tool / Dev Server)

### Community 18 - "Electron Window Bootstrap"
Cohesion: 0.67
Nodes (2): createWindow(), safeHandler()

### Community 19 - "Minified Bundle (C19)"
Cohesion: 0.5
Nodes (4): ht(), jg(), Lp(), Vp()

### Community 20 - "Minified Bundle (C20)"
Cohesion: 0.5
Nodes (4): cx(), dS(), fs(), Tx()

### Community 21 - "React App Root"
Cohesion: 0.5
Nodes (0): 

### Community 22 - "Minified Bundle (C22)"
Cohesion: 0.67
Nodes (3): Jx(), ol(), zx()

### Community 23 - "Minified Bundle (C23)"
Cohesion: 0.67
Nodes (3): _1(), ps(), yc()

### Community 24 - "Leaderboard Page"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Minified Bundle (C25)"
Cohesion: 1.0
Nodes (2): Eb(), Hp()

### Community 26 - "Minified Bundle (C26)"
Cohesion: 1.0
Nodes (2): qS(), YS()

### Community 27 - "Minified Bundle (C27)"
Cohesion: 1.0
Nodes (2): av(), fn()

### Community 28 - "Minified Bundle (C28)"
Cohesion: 1.0
Nodes (2): Aa(), zv()

### Community 29 - "Minified Bundle (C29)"
Cohesion: 1.0
Nodes (2): as(), oS()

### Community 30 - "Minified Bundle (C30)"
Cohesion: 1.0
Nodes (2): Ab(), Tb()

### Community 31 - "cn() Class-merge Utility"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Dashboard Page"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Profile Settings Page"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Type Definitions"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "ESLint Config"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Electron Preload (built)"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Electron Preload (source)"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Dialog UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Button UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Select UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Input UI Component"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **25 isolated node(s):** `React Compiler`, `Type-aware ESLint Configuration`, `selftest.mjs (Protocol Checks)`, `loopback.mjs (Controller Self-test)`, `events.jsonl Log` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Minified Bundle (C25)`** (2 nodes): `Eb()`, `Hp()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Minified Bundle (C26)`** (2 nodes): `qS()`, `YS()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Minified Bundle (C27)`** (2 nodes): `av()`, `fn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Minified Bundle (C28)`** (2 nodes): `Aa()`, `zv()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Minified Bundle (C29)`** (2 nodes): `as()`, `oS()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Minified Bundle (C30)`** (2 nodes): `Ab()`, `Tb()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cn() Class-merge Utility`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Page`** (2 nodes): `Dashbaord()`, `Dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Settings Page`** (2 nodes): `ProfileSettings()`, `ProfileSettings.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Type Definitions`** (1 nodes): `types.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Electron Preload (built)`** (1 nodes): `preload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Electron Preload (source)`** (1 nodes): `preload.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dialog UI Component`** (1 nodes): `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button UI Component`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Select UI Component`** (1 nodes): `select.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Input UI Component`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `React Compiler`, `Type-aware ESLint Configuration`, `selftest.mjs (Protocol Checks)` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Minified Bundle Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Minified Bundle Entry` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `USB-CAN RFID Firmware & Protocol` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Minified React Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._