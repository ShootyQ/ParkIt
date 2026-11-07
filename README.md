# ParkIt

A tiny shopping-center parking lot with an unreasonable amount going on. A landscape-first Canvas game built with TypeScript and Vite. No account, backend, API keys, or runtime network requests required.

## Develop

Requires Node.js 22.12+ (validated with Node 24).

```sh
npm ci --cache /tmp/parkit-npm
npm run dev
```

## Play

Press a waiting car and draw its complete route through the aisles into any empty space. Finish fully inside the markings, facing inward. The ghost car previews the final pose; a yellow path needs correcting. Wide turns are easier than sharp corners. Release to send the car; press Escape to discard an unfinished route.

Watch for flashing reverse lights. Draw backward out into the center aisle, then turn your line back toward the direction the car faces and continue to the bottom-right exit. The D marker shows where the car switches from reverse to forward. Routes are checked against curbs and stationary cars, but crossing moving traffic can crash.

Parking earns 100 points; departures earn 150. Three lives, 30-second patience, and a three-car entrance queue. Every five departures increases arrival frequency. Starting a shift requests fullscreen automatically. The fullscreen button lets you leave or re-enter it; browsers that do not support fullscreen still get a viewport-filling layout. Space pauses; the buttons restart and mute. The page pauses when hidden. Rotate phones to landscape. Best score and preferences are saved locally when storage is available.

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

The lot is drawn from the same geometry used by collision checks. Cars use oriented rectangles; route validation samples at most five pixels apart and simulation runs at 60 fixed steps per second. A typical car travels at most 1.5 pixels per step. No image or font downloads are needed.

## Deploy

GitHub Actions builds and deploys pushes to `main` using `.github/workflows/deploy.yml`.
In repository **Settings → Pages**, select **GitHub Actions** as the build source.
Vite uses relative asset URLs so the game works under the repository's `/ParkIt/` path.

## Full-width phone play

The game fills the viewport from initial load, including in embedded browsers that reject native fullscreen. Cars and collision bounds are 15% larger; vehicle proportions stay consistent as the lot expands across wide screens.

On iPhone, a webpage cannot dismiss an in-app browser's status and address bars. Open the game in Safari, use **Share → Add to Home Screen** (enable **Open as Web App** if shown), and launch that icon for standalone play. The included web app manifest and Apple metadata support that launch mode; no offline caching is installed.
