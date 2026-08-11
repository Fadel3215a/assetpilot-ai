# AssetPilot AI

An experimental AI asset curation and digital asset management workspace.

AssetPilot AI is a portfolio prototype demonstrating how a human curator can organize, evaluate, compare, classify, and prepare AI-generated digital assets for production. It is **not** a production enterprise DAM system — all data is fictional mock content for demonstration purposes.

## Workflow

```
AI-generated asset → Intake → Organization → Curation → Quality review
→ Classification → Comparison → Approve / Reject → Version tracking → Production readiness
```

Human judgment drives approval decisions. The interface emphasizes structured curator workflows rather than automated AI decision-making.

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

## Phase 1 Features

- Dashboard with workflow summary and activity feed
- Asset Library with search and filters
- Asset detail view with metadata, versions, and review actions
- Session-only approve / reject / request changes
- Responsive sidebar navigation

## Phase 2 Features

- Curation Queue with priority, filters, and sorting
- Curator Review Workspace with structured quality checklist
- Curator Quality Score (transparent checklist-based calculation)
- Decision history with timestamps and reasons
- Side-by-side asset comparison
- Collections browser with asset counts
- Reviews dashboard
- Production readiness checklist (curator-driven)

## Demo Data

All assets, collections, quality scores, and curator names are fictional. No real client work is represented.
