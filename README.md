# Idea Parking Lot

Park sparks before they vanish.

[Live site](https://adarsh1313.github.io/idea-parking-lot/) · [Repository](https://github.com/Adarsh1313/idea-parking-lot)

## The Problem, Tragically

Some ideas arrive like responsible adults with a roadmap, a budget, and a calendar invite.

Most ideas arrive at 1:13 AM wearing sunglasses indoors, shouting "what if we made this into an app?" before disappearing forever into a notes app called `Untitled 47`.

**Idea Parking Lot** is a small 3D web app for catching those ideas, parking them in visible spaces, and deciding later whether they deserve the highway or the scrapyard.

## What It Does

Idea Parking Lot lets you:

- Create ideas as parked cars in a 3D parking lot.
- Add titles, descriptions, and links for each idea.
- Mark ideas as active when they are worth pursuing.
- Edit or delete ideas when they evolve or stop making sense.
- Keep data locally in the browser by default.
- Optionally sync ideas to GitHub as a tiny JSON-backed database.
- Export and import idea backups as JSON.

## Use Case

This is for personal idea capture, lightweight planning, and tiny to-do-ish project tracking.

It is intentionally smaller than Notion, less ceremonial than Jira, and more visually memorable than a plain checklist. The core loop is simple: park an idea, revisit it, activate it, or clear the space.

## Stack

- **React 19** for the app UI.
- **TypeScript** for safer app logic.
- **Vite** for local development and static builds.
- **Three.js**, **React Three Fiber**, and **Drei** for the 3D parking lot.
- **Zustand** for client-side state management.
- **Dexie / IndexedDB** for local browser persistence.
- **GitHub Contents API** for optional GitHub-backed JSON storage.
- **Vitest** for unit tests.
- **Playwright** for end-to-end tests.
- **GitHub Actions + GitHub Pages** for deployment.

## Data Model

Ideas are stored as small JSON objects:

```ts
type Idea = {
  id: string;
  slotIndex: number;
  title: string;
  description?: string;
  links: string[];
  status: "parked" | "active";
  carVariant: string;
  carColor: string;
  createdAt: string;
  updatedAt: string;
};
```

When GitHub sync is enabled, the app writes the idea collection to:

```txt
data/ideas.json
```

## GitHub-Backed Storage

The deployed GitHub Pages app is static, so it cannot write to the repo by itself. To enable sync, click **Connect GitHub** in the app and paste a fine-grained GitHub token with **Contents: Read and write** access for this repository.

The token is stored only in your browser's local storage. Do not commit it, share it, screenshot it, tattoo it on your forearm, or whisper it to a suspicious raccoon.

With sync enabled:

- Opening the app pulls ideas from `data/ideas.json`.
- Creating, editing, deleting, or activating ideas saves back to GitHub.
- The local IndexedDB copy still exists as a fast browser cache.

## Local Development

Install dependencies:

```bash
npm ci
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run unit tests:

```bash
npm test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## Deployment

The app deploys automatically to GitHub Pages via `.github/workflows/deploy.yml`.

Every push to `main` runs:

```bash
npm ci
npm run build
```

Then GitHub Pages publishes the generated `dist` folder.

## Scope

In scope:

- Personal idea capture.
- Small project/to-do tracking.
- Browser-first persistence.
- Optional GitHub-backed sync.
- Lightweight JSON export/import.
- A playful 3D parking lot metaphor.

Out of scope for now:

- Multi-user collaboration.
- Role-based permissions.
- Server-side auth.
- Large file attachments.
- Complex kanban/project management workflows.
- Replacing a serious database-backed productivity platform.

## Roadmap Ideas

- Archive mode for ideas that are done, paused, or gently abandoned.
- Search and filtering.
- Tags or lanes for idea categories.
- Better sync conflict handling.
- Screenshot or OG image generation.
- Mobile interaction polish.

## License

Personal project. Add a formal license before using this as a reusable public template.
