# AssetPilot AI

**Human-in-the-loop AI-assisted digital asset curation.**

AssetPilot AI is an independent experimental portfolio project exploring how a human curator can organize, evaluate, compare, classify, and prepare digital assets for production—with simulated AI assistance that never replaces human judgment.

It is **not** a commercial product, **not** connected to a real organization, and **not** a production enterprise DAM system.

---

## Overview

AssetPilot models an internal creative-operations workflow: assets arrive, metadata is managed, quality is assessed, AI offers suggestions, and a curator makes every final decision.

The application runs entirely in the browser with session-only state—no database, authentication, or external AI APIs.

## Problem

Digital asset teams face growing volume, inconsistent metadata, duplicate files, version sprawl, and pressure to move assets to production quickly. AI can help surface patterns and suggestions, but approval, rejection, and production readiness require accountable human judgment.

## Solution

AssetPilot demonstrates a structured curation workflow where:

1. Assets are discovered and organized (library, collections, search, filters)
2. Metadata is extracted and edited locally
3. Simulated AI analysis suggests tags, collections, and observations
4. Curators evaluate quality via checklist and scoring
5. Comparisons and version history support decision-making
6. Production readiness is checklist-driven—not AI-automated

**Core design principle:** AI assists the curator. The curator makes the final decision.

## Key Features

| Area | Capabilities |
|------|----------------|
| **Asset management** | Session-only upload, real image/video/audio previews, metadata extraction & editing, search, filters, bulk ops, versions |
| **Discovery** | Related assets (metadata-based), possible duplicates (metadata-based), asset health |
| **Curation** | Queue, review workspace, quality checklist, curator quality score, decision history |
| **AI assistance** | Simulated analysis, tag/collection/observation suggestions, comparison & readiness summaries |
| **Production** | Checklist-based readiness, blocking-item visibility, curator-driven status |
| **Operations** | Dashboard metrics, reviews history, activity timeline, demo session reset |

## Workflow

```
Discover → Understand → Review → Decide → Prepare for Production
```

**Recommended demo path:**

Dashboard → Curation Queue → Review Workspace → Compare Assets → Production Readiness

**Also try:** Asset Library → Upload → Extracted Metadata → Edit Metadata → Related Assets → Versions

## AI Architecture

```
Asset data → AIAnalysisProvider → AIAnalysisResult → UI
```

- **`AIAnalysisProvider`** interface defines the boundary
- **`MockAIAnalysisProvider`** is the current deterministic implementation
- UI components consume `asset.aiAnalysis`—not the mock generator directly
- A real model could replace the provider without rewriting the UI

AI outputs are labeled **AI Suggestion**, **Simulated AI Analysis**, or **Demo Confidence** throughout the app.

## Human-in-the-Loop Design

- AI suggestions require explicit Accept, Edit, or Dismiss
- Approve / Request Changes / Reject are curator-only actions
- Comparison and production decisions require curator reasons
- Curator Feedback history records human responses—it is not model training
- Nothing is auto-approved or auto-rejected by AI

## Asset Management Capabilities

- **Upload:** Browser File API, object URLs, session-only storage
- **Metadata:** Extracted (file properties) vs AI suggestions clearly separated
- **Duplicates:** Metadata-based detection—not visual or AI similarity
- **Related assets:** Collection, tags, type, description keywords
- **Versions:** Create without deleting prior versions
- **Bulk ops:** Add/remove tags, move collection (with confirmation)

## Technology Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- React Context (session state)

No database, auth, cloud storage, or external AI services.

## Design Decisions

- **Session-only state** keeps the demo self-contained and privacy-safe
- **Deterministic mock AI** makes portfolio demos reproducible without API keys
- **Explicit labeling** prevents misleading claims about real inference
- **Checklist-driven production** mirrors real DAM governance patterns
- **Provider abstraction** documents intent for future real AI integration

## Limitations

- Uploads and edits are lost on refresh (session-only)
- No persistent storage, user accounts, or multi-tenant support
- AI is simulated—not connected to OpenAI, Gemini, Anthropic, or similar
- Duplicate and related-asset discovery is metadata-based only
- Seeded demo assets are fictional—not real client work
- Confidence levels are demo labels, not calibrated probabilities

## Future Improvements

- Optional real AI provider behind `AIAnalysisProvider`
- Persistent storage with proper auth (outside portfolio scope)
- Visual similarity / perceptual duplicate detection
- Export and delivery integrations
- Team roles and audit trails

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

## Deployment (GitHub Pages)

AssetPilot AI is configured for static hosting on GitHub Pages:

**Live URL:** [https://fadel3215a.github.io/assetpilot-ai/](https://fadel3215a.github.io/assetpilot-ai/)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds and deploys on pushes to `main`.

### Build for GitHub Pages locally

```bash
# Linux / macOS / Git Bash
GITHUB_PAGES=true npm run build
```

The static site is written to the `out/` directory. No Node.js server is required—GitHub Pages serves these files directly.

### Deployment notes

- This is a **static portfolio/demo deployment**—all app state remains **browser-only**
- **Uploaded files are not persisted**; refreshing the page may clear session uploads
- **AI analysis remains simulated/deterministic**—no external AI API is connected
- Pre-rendered routes cover seeded demo assets and collections; session-uploaded assets work via in-app navigation but may not have a dedicated static HTML file until you rebuild

## Portfolio / Demo Notes

- Use **Reset demo session** in the sidebar to restore seeded data and clear session changes
- All asset names, collections, and curator identities are fictional
- Files uploaded during a session are processed locally and never sent to a server
- This project is suitable for demonstrating DAM operations, metadata discipline, quality control, and human-in-the-loop AI workflow design

## Project Structure

```
app/           # Next.js routes
components/    # UI and feature components
components/ui/ # Primitives
data/          # Seeded mock assets and collections
lib/           # Context, AI provider, utilities
types/         # Domain types
public/        # Static demo thumbnails
```

## Phases

- **Phase 1** — Foundation (dashboard, library, review state)
- **Phase 2** — Curation workflow (queue, checklist, comparison, collections, production readiness)
- **Phase 3** — AI-assisted intelligence (simulated analysis, suggestions, feedback)
- **Phase 4** — Asset intelligence & media management (upload, metadata, duplicates, versions, bulk ops)
- **Phase 5** — Production polish & portfolio readiness (UX, accessibility, demo reset, documentation)

---

*AssetPilot AI — independent portfolio project. Simulated AI. Human decisions.*
