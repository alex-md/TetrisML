# Repository Guidelines

## Project Structure & Module Organization
- `App.tsx` is the main entry point and handles routing, persistence, and Web Worker wiring.
- Simulation engine lives in `services/simulation/` (`TetrisGame.ts`, `EvolutionEngine.ts`, and `simulation.worker.ts`).
- UI is split between `components/` (reusable widgets) and `pages/` (feature views like Arena, Telemetry, Lineage, Timeline).
- Shared types/config are in `types.ts` and `constants.ts`.
- Cloudflare Worker backend is in `backend/src/index.js` with KV binding in `backend/wrangler.toml`.
- Static assets are in `public/`, and production builds land in `dist/`.

## Build, Test, and Development Commands
Frontend (repo root):
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server.
- `npm run build` builds to `dist/`.
- `npm run preview` serves the production build locally.

Backend (from `backend/`):
- `npm install` installs Worker dependencies.
- `npm run dev` runs the local Worker (Wrangler).
- `npm run deploy` deploys the Worker to Cloudflare.

## Coding Style & Naming Conventions
- TypeScript + React, ES modules. Components are `PascalCase` (e.g., `FloatingArenaCard.tsx`).
- Indentation is 4 spaces in existing files; match nearby style for quotes and semicolons.
- Use the `@/*` alias from `tsconfig.json` for imports when it improves readability.
- No enforced formatter or linter—keep changes consistent and minimal.

## Testing Guidelines
- There is no automated test suite configured.
- `backend/npm run test` is a placeholder and fails by design.
- Validate changes manually via `npm run dev` and by exercising the UI paths you modified.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and sentence case (e.g., “Update constants.ts”).
- PRs should explain behavioral changes and link related issues.
- Include screenshots or gifs for UI changes and call out any persistence impacts.

## Configuration Tips
- `API_BASE` in `App.tsx` controls which Worker the frontend uses.
- The backend KV binding is named `KV`; update `backend/wrangler.toml` when changing namespaces.
