# CropMind AI

**Autonomous crop insurance pre-qualification — from field photo to FCIC claim report in minutes.**

CropMind AI eliminates the 72-hour documentation bottleneck that causes farmers to forfeit flood damage indemnities. When a severe weather event strikes, farmers traditionally wait days for a licensed adjuster to arrive — often past the FCIC filing deadline. CropMind AI replaces that wait with an autonomous multi-agent AI pipeline triggered directly from a smartphone.

---

## The Problem

Under FCIC rules, a farmer must file a Notice of Loss within **72 hours** of discovering flood damage. Missing that window can void coverage entirely. Yet:

- A licensed adjuster may take **3–7 days** to visit a remote field
- Farmers lack tools to self-document damage in the format adjusters require
- FCIC policy language is dense and inaccessible — most farmers don't know which sections apply to their specific loss event

**The result:** billions in legitimate crop insurance claims are delayed, underpaid, or forfeited every year.

---

## The Solution

CropMind AI puts a pre-qualification adjuster in every farmer's pocket.

1. **Scout** — Walk the field, capture GPS-tagged photos at damage points
2. **Submit** — Upload through the mobile app in one tap
3. **Wait ~2 minutes** — The AI pipeline runs autonomously
4. **Receive** — A fully structured claim pre-qualification report with FCIC policy citations, satellite precipitation data, and an adjuster-ready action checklist

---

## Architecture

### Frontend
- **React 18** + **Vite 7** + **Tailwind CSS v4**
- **React Three Fiber** — procedural 3D terrain "Digital Twin" showing elevation ridges and flood pooling basins
- **React Router v7** — four-tab mobile shell: Scout, Agents, Map, Report
- **Recharts** — precipitation histograms and damage visualizations

### Backend
- **FastAPI** — REST API with async background pipeline execution
- **LangGraph** — directed acyclic graph orchestrating 7 specialized AI agents
- **Supabase** — PostgreSQL database, object storage (photos), and pgvector for RAG

### AI / ML
- **Anthropic Claude 3.5 Sonnet** — multimodal vision analysis of scouting photos
- **sentence-transformers `all-MiniLM-L6-v2`** — 384-dim vector embeddings for insurance RAG
- **Supabase pgvector** — cosine similarity search over FCIC policy chunk database

---

## Agent Pipeline

The LangGraph DAG executes three agents in parallel, then fans into a sequential tail:

```
START
  ├──▶ Vision Agent          ─┐
  ├──▶ Environmental Agent   ─┼──▶ Flood Classifier
  └──▶ Satellite Agent       ─┘         │
                                         ▼
                                   Spatial Agent
                                         │
                                  Insurance Agent  (RAG)
                                         │
                                  Synthesis Agent
                                         │
                                        END
```

### Agent Descriptions

| Agent | Role | Data Sources |
|---|---|---|
| **Vision Agent** | Analyzes scouting photos for standing water, silt lines, plant necrosis, and growth stage (V-stage) using Claude Vision. Applies FCIC pre-V6 growing point rule. | Farmer-submitted photos via Claude 3.5 Sonnet |
| **Environmental Agent** | Fetches 7-day trailing precipitation and soil moisture centered on the field GPS centroid. Estimates submersion hours from precip + saturation heuristics. | Open-Meteo Archive API, Open-Elevation API |
| **Satellite Agent** | Retrieves cumulative precipitation and volumetric soil moisture (0–7cm) time series for the event window. | Open-Meteo |
| **Flood Classifier** | Determines the FCIC flood pathway: `prevented_planting`, `replant_eligible`, `stand_mortality`, or `partial_damage`. Synthesizes all three parallel agent outputs. | Vision + Environmental + Satellite outputs |
| **Spatial Agent** | Clusters scouting points into damage zones by elevation. Assigns ridge/basin/intermediate classification per point. | GPS coordinates + elevation data |
| **Insurance Agent** | Embeds `flood_pathway + crop_type` → 384-dim vector → queries `match_policies` Supabase RPC → retrieves top FCIC policy chunks → generates grounded action items. | pgvector RAG, sentence-transformers |
| **Synthesis Agent** | Compiles all upstream outputs into an executive summary, conflict flags, confidence score, and adjuster-ready narrative using Claude. | All upstream agent outputs |

---

## Key Features

### Mobile-First Scouting
- GPS + EXIF metadata extracted from every photo (`exifr`)
- One-tap multipart form submission with real-time pipeline status polling
- Session persistence via `localStorage` — resume assessments after refresh

### 3D Digital Twin Map
- Procedural terrain from `PlaneGeometry` (128×128 segments) with vertex displacement
- Ridge (+2.8 world units) and basin (−2.5 world units) topology derived from elevation data
- Animated water pool at basin floor with pulsing opacity (`useFrame`)
- Neon-emerald field boundary rendered as `CatmullRomCurve3` → `TubeGeometry` with emissive glow
- 3D elevation pins with `@react-three/drei` `Html` overlays — clickable to open scouting detail sheet
- Auto-rotating `OrbitControls` with damping, pinch/drag, and auto-resume

### Insurance RAG Pipeline
- FCIC policy text chunked and embedded at ingest using `all-MiniLM-L6-v2`
- Supabase `match_policies` RPC with configurable cosine similarity threshold (0.5) and match count (2)
- Retrieved chunks drive both policy card display and action item generation
- Grounded action items cite specific policy provisions rather than generic advice

### Claim Report
- **Geotagged Field Evidence** — photos with EXIF HUD overlays (coordinates, elevation, severity status badge)
- **FCIC Policy Matches** — legal-document cards with emerald left border, fully expanded policy text, similarity score
- **Satellite Weather Panel** — large neon precipitation readout overlaid on radar/satellite imagery
- **Action Checklist** — interactive SVG checkboxes with urgency levels and completion progress bar
- **Print / Download** — full print stylesheet for PDF adjuster submission

---

## Data Sources & Provenance

| Source | Data Used | License |
|---|---|---|
| Open-Meteo Archive API | 7-day cumulative precipitation, soil moisture (0–7cm) | CC BY 4.0 |
| Open-Elevation API | Field elevation in metres | ODbL |
| USDA RMA / FCIC | Policy text for RAG vector database | Public Domain (U.S. Gov.) |
| Farmer (primary source) | GPS-tagged scouting photos, crop type, event date | User-owned |
| Anthropic Claude API | Vision inference only — no data retained by Anthropic | Inference only |

No farmer data is sold, shared, or used for model training. All photos and assessment results are scoped to the individual user session.

---

## Project Structure

```
cropmindai/
├── src/                              # React frontend
│   ├── components/
│   │   ├── Field3D.jsx               # Procedural 3D terrain canvas (R3F)
│   │   ├── Map3D.jsx                 # Map page wrapper + UI chrome
│   │   ├── ClaimReport.jsx           # Full printable claim report
│   │   ├── InsuranceReport.jsx       # FCIC dashboard (default report tab)
│   │   ├── ScoutingScreen.jsx        # Photo capture + GPS submission
│   │   └── AgentCouncil.jsx          # Live pipeline status display
│   ├── context/
│   │   └── AssessmentContext.jsx     # Global state, polling, API adapter
│   ├── api/
│   │   └── client.js                 # Typed fetch wrappers
│   └── pages/
│       ├── ScoutPage.jsx
│       ├── AgentsPage.jsx
│       ├── MapPage.jsx
│       └── ReportPage.jsx
│
├── backend/
│   └── app/
│       ├── main.py                   # FastAPI app + CORS
│       ├── config.py                 # Pydantic settings (reads .env)
│       ├── routers/
│       │   └── assessments.py        # POST /api/assessments, GET /status, GET /:id
│       └── agents/
│           ├── graph.py              # LangGraph DAG definition
│           ├── state.py              # FloodAssessmentState TypedDict
│           ├── vision.py             # Claude Vision agent
│           ├── environmental.py      # Open-Meteo + elevation agent
│           ├── satellite.py          # Satellite data agent
│           ├── flood_classifier.py   # FCIC pathway classifier
│           ├── spatial.py            # Zone clustering agent
│           ├── insurance.py          # RAG insurance agent (pgvector)
│           └── synthesis.py          # Executive summary agent (Claude)
│
├── supabase_migration_01.sql         # Core schema
├── supabase_migration_02.sql         # Pipeline output columns
└── backend/migrations/
    └── 001_create_assessments.sql
```

---

## Setup & Installation

### Prerequisites
- Node.js 20+
- Python 3.11+
- A [Supabase](https://supabase.com) project with the `pgvector` extension enabled

### 1. Clone the repository

```bash
git clone https://github.com/your-username/cropmindai.git
cd cropmindai
```

### 2. Frontend

```bash
npm install
```

Create `.env` in the project root:
```env
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev:local
```

The app runs at `http://localhost:5173`.

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
FRONTEND_URL=http://localhost:5173
```

```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

### 4. Database

Run migrations in order inside the **Supabase SQL Editor**:

```sql
-- 1. Core schema (assessments table, RLS)
-- Run contents of: supabase_migration_01.sql

-- 2. Pipeline output columns
-- Run contents of: supabase_migration_02.sql
```

Enable pgvector and deploy the `match_policies` RPC function for the Insurance RAG agent. See `supabase_migration_02.sql` for the full function definition.

### 5. Mobile / Local Network Testing

```bash
npm run dev   # starts Vite with --host + tunnel script
```

The tunnel script exposes the frontend on your local network IP so you can test on a physical phone over WiFi.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/assessments` | Submit photos + metadata, triggers background pipeline |
| `GET` | `/api/assessments/{id}/status` | Poll pipeline status (`pending` / `processing` / `completed` / `failed`) |
| `GET` | `/api/assessments/{id}` | Fetch full completed assessment row |
| `GET` | `/health` | Health check — returns `{ status: "ok", version: "2.0-flood" }` |

---

## FCIC Compliance Notes

This tool generates **pre-qualification assessments only**. It does not replace a licensed FCIC loss adjuster. Key agronomic rules implemented:

- **Pre-V6 growing point rule** — corn below V6 has its growing point underground; the vision agent explicitly checks stalk base firmness before classifying stand loss, following FCIC germination survival protocol
- **72-hour notice requirement** — action item #1 on every generated report, with pathway-specific deadline language
- **Replant consent** — system flags that AIP written consent is required before replanting; unauthorized replanting forfeits prevented-planting indemnity
- **APH documentation** — adjuster is directed to verify Actual Production History yield records for the affected unit structure

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend framework | React 18, Vite 7 |
| Styling | Tailwind CSS v4 |
| 3D visualization | Three.js, React Three Fiber, Drei |
| Charts | Recharts |
| Icons | Lucide React |
| Backend framework | FastAPI |
| Agent orchestration | LangGraph |
| Vision AI | Anthropic Claude 3.5 Sonnet |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector search | Supabase pgvector |
| Object storage | Supabase Storage |
| Database | Supabase (PostgreSQL) |
| Weather data | Open-Meteo Archive API |
| Elevation data | Open-Elevation API |

---

## License

MIT

---

*CropMind AI — built for farmers, designed for adjusters, powered by AI.*
