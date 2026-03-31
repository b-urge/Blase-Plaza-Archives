# Blasé Plaza Archives

## Overview

A full-stack web application that documents commercial plazas in Miami-Dade County scheduled for demolition or major renovation. Styled as a deliberate 1990s county government website aesthetic (Windows 98 grey, dark navy headers, beveled buttons, Courier New typewriter reports).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **AI**: Anthropic Claude (via Replit AI Integrations) — `claude-sonnet-4-6`
- **Map**: Leaflet.js + react-leaflet v5 RC
- **Geocoding**: OpenStreetMap Nominatim

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (routes: surveys, permits)
│   └── blase-plaza/        # React + Vite frontend (retro 1990s aesthetic)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-anthropic-ai/  # Anthropic AI client + batch utilities
├── scripts/                # Utility scripts
└── pnpm-workspace.yaml     # pnpm workspace
```

## Features

- **Map View** (`/map`): Leaflet.js interactive map of Miami-Dade with colored pins by demolition horizon (Red=IMMINENT, Amber=NEAR-TERM, Yellow=PROJECTED, Grey=EXPIRED)
- **List View** (`/list`): Sortable HTML-style table with search/filter controls
- **Report Card View** (`/report/:id`): Full typewritten survey report in Courier New with government form styling
- **About** (`/about`): Static archival description page
- **Home** (`/`): Stats dashboard + database initialization button

## Data Sources

- Miami-Dade Open Data (Socrata): `https://opendata.miamidade.gov/resource/rbng-6mha.json`
- Fallback: 6 pre-defined sample addresses from Miami-Dade commercial corridors
- Geocoding: OpenStreetMap Nominatim

## AI Survey Generation

Each permit record generates a full structured survey via Claude `claude-sonnet-4-6`, including:
- Plaza classification and architectural style
- Environmental metrics (parking entropy, shade coverage, etc.)
- Commercial species observed (likely business types)
- Field notes in neutral bureaucratic tone

## Database Schema

**`surveys` table**: siteId, plazaName, location, surveyDate, demolitionHorizon, plazaType, architecturalStyle, all environmental metrics, reportText (full Claude output), permit metadata, lat/lng, status, timestamps

## API Routes

- `GET /api/surveys` — list surveys (filter: horizon, search; sort: any column)
- `GET /api/surveys/stats` — totals by horizon
- `GET /api/surveys/:id` — single survey
- `POST /api/permits/seed` — seed 6 sample surveys using Claude
- `POST /api/permits/sync` — sync from Miami-Dade API (falls back to seed if API unreachable)
- `GET /api/healthz` — health check

## First-Run Setup

Click the "[ INITIALIZE DATABASE RECORDS ]" button on the home page to generate AI surveys for all 6 sample locations. This calls Claude API for each address.
