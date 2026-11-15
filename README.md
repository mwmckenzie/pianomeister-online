# PianoMeister Online

A browser-based piano practice visualizer. MIDI songs scroll down a perspective note highway toward an 88-key keyboard. See [`docs/brief.md`](docs/brief.md) for scope and design.

Deployed to GitHub Pages under `/pianomeister-online/`.

## Setup

```sh
npm install
npx playwright install chromium   # first e2e run only
```

## Scripts

| Command             | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `npm run dev`       | Dev server at `http://localhost:5173/pianomeister-online/`                 |
| `npm run check`     | Type-check, oxlint + ESLint (no fixes) and Vitest once — must pass         |
| `npm run build`     | Type-check and production build to `dist/`                                 |
| `npm run preview`   | Serve the production build at `http://localhost:4173/pianomeister-online/` |
| `npm run test:unit` | Vitest in watch mode                                                       |
| `npm run test:e2e`  | Playwright (Chromium); uses the dev server locally, preview on CI          |
| `npm run lint`      | oxlint + ESLint, report only                                               |
| `npm run lint:fix`  | oxlint + ESLint with auto-fix                                              |
| `npm run format`    | Prettier on `src/`                                                         |
