# ParkIt

A tiny shopping-center parking lot with an unreasonable amount going on. A landscape-first Canvas game built with TypeScript and Vite. No account, backend, API keys, or runtime network requests required.

## Develop

Requires Node.js 22.12+ (validated with Node 24).

```sh
npm ci --cache /tmp/parkit-npm
npm run dev
```

## Play

Press a car and draw exactly where it should go. Release to drive. Lines are never rerouted, straightened into a space, or rejected for sharp turns, final angle, an occupied bay, or a curb crossing. A line starting behind the car makes it reverse; a turnaround in your line changes direction again. Curbs and other cars can cause crashes while driving.

Spaces are sized to the car, with a little clearance. Parking scores 100 only when the actual stopped car fits inside a space, in either direction. Miss the space? The car stops where you drew: draw another line to adjust it. You can also move parked cars. Each car earns its parking points once, then earns 150 when you guide it to the exit. Watch the reverse lights for drivers who want to leave.

Three lives, 30-second patience, and a three-car entrance queue. Every five departures increases arrival frequency. Starting a shift requests fullscreen; the button exits or re-enters it. Embedded browsers still get full-width play. Space pauses; Escape discards an unfinished drawing. The page pauses when hidden. Best score and mute preference are saved locally when storage is available.

## Validate

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use `/usr/bin/chromium`. Set `CHROMIUM_PATH` to your own Chromium executable when necessary. Build output is in `dist/` and can be deployed to any static host. `npm run dev` is for development only.

## Structure

- `src/game.ts`: layout, geometry, path validation, fixed-step vehicle simulation, scoring and traffic rules.
- `src/main.ts`: Canvas scenery and vehicles, pointer input, tutorial, audio and DOM controls.
- `src/style.css`: responsive interface and portrait guidance.

The lot is drawn from the same geometry used by collision checks. Cars use oriented rectangles; routes are subdivided at most four pixels apart without changing the drawn shape and simulation runs at 60 fixed steps per second. A typical car travels at most 1.5 pixels per step. No image or font downloads are needed.

## Deploy

GitHub Actions builds and deploys pushes to `main` using `.github/workflows/deploy.yml`.
In repository **Settings → Pages**, select **GitHub Actions** as the build source.
Vite uses relative asset URLs so the game works under the repository's `/ParkIt/` path.

## Full-width phone play

The game fills the viewport from initial load, including in embedded browsers that reject native fullscreen. Cars and collision bounds are 15% larger; vehicle proportions stay consistent as the lot expands across wide screens.

On iPhone, a webpage cannot dismiss an in-app browser's status and address bars. Open the game in Safari, use **Share → Add to Home Screen** (enable **Open as Web App** if shown), and launch that icon for standalone play. The included web app manifest and Apple metadata support that launch mode; no offline caching is installed.
