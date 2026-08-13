# MFL Transaction Viewer

A SvelteKit web application for viewing fantasy football transactions from MyFantasyLeague.

## Features

- **Multi-League Support** - Select from any of your MFL leagues
- **Transaction Types** - View Add/Drop, Trade, and Waiver transactions
- **Pending Waivers** - See pending blind-bid waiver claims with FAAB bids
- **Free Agents** - Browse available players across your leagues with ADP and roster percentages
- **Player Profiles** - Click any player to view their profile
- **Position Badges** - Color-coded badges identify player positions
- **Responsive Design** - Works on desktop and mobile devices
- **Dark Theme** - Modern dark UI with vibrant accent colors

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Quality checks

```bash
npm run check    # svelte-check / type checking
npm run lint     # eslint
npm run format   # prettier
npm run build    # production build
```

## Tech Stack

- Svelte 5 / SvelteKit
- TypeScript
- MFL API Integration

## Architecture

- `src/lib/mfl.ts` - Raw MyFantasyLeague API client with TTL caching
- `src/lib/enrichment.ts` - Pure parsers/formatters that enrich raw MFL responses
- `src/lib/cache.ts` - Generic TTL cache used by the API layer
- `src/lib/components/` - Reusable UI components (Header, Sidebar, cards, toolbars)
- `src/routes/api/mfl/` - Server-side proxy that forwards enriched data to the client
