# AssetPilot AI

An experimental AI asset curation and digital asset management workspace.

AssetPilot AI explores a **human-in-the-loop approach to AI-assisted digital asset curation**. It is a portfolio prototype demonstrating how a human curator can organize, evaluate, compare, classify, and prepare AI-generated digital assets for production. It is **not** a production enterprise DAM system.

## Important transparency

- **AI analysis is simulated** in the current prototype — no real AI inference is connected
- **Final decisions remain with the human curator** — AI suggests, humans decide
- **No production client data** is used — all assets and collections are fictional
- **Confidence levels are demo labels** — not calibrated model probabilities

## Workflow

```
AI-generated asset → Intake → Organization → Curation → Quality review
→ Classification → Comparison → Approve / Reject → Version tracking → Production readiness
```

Human judgment drives approval decisions. AI assists with suggestions; curators review, accept, edit, or dismiss them.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
app/           # Next.js App Router pages
components/    # UI and feature components
components/ui/ # Primitive UI elements
data/          # Mock seed data
lib/           # Utilities and React context
types/         # TypeScript domain types
public/        # Static assets and thumbnails
```

## Features

### Phase 1 — Foundation
- Dashboard, Asset Library, session-based review state

### Phase 2 — Curation Workflow
- Curation Queue, Review Workspace, quality checklist, comparison, collections, production readiness

### Phase 3 — AI-Assisted Intelligence
- Simulated AI analysis panel in review workspace
- Tag, collection, and observation suggestions with Accept / Edit / Dismiss
- AI comparison and production readiness summaries
- Curator Feedback history (not model training)
- Dashboard AI assistance metrics

## Demo Data

All assets, collections, quality scores, AI suggestions, and curator names are fictional. No real client work is represented.
