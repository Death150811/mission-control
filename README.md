# MISSION CONTROL — Every decision has an orbit

An interactive space-mission design and flight-operations simulator. You receive a scientific objective, a budget and engineering
constraints, then **build** a spacecraft from physical modules in a **volumetric 3D workshop**, **assemble** a launch vehicle,
**qualify** the design in a test facility, **fly** the ascent and the injection burn yourself, **operate** the mission day by day,
and read an engineering debrief that explains *why* it succeeded or failed.

Physics-sandbox inspiration, original identity: the project takes the *idea* of build–fly–learn from physics-driven space games,
but all artwork, names, rules and interfaces are its own. The visual language is a flight-console look using the public NASA palette
(blue `#0B3D91`, red `#FC3D21`, white, console amber/green) with original emblem and mission-patch artwork; it is not an agency product.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 86 unit tests: physics, orbits, eclipse/drag/radiation, link budget, launch, launch windows, flight,
                   # thermal balance, test facility, maneuver planner, boosters, tech tree, validation, simulator, scoring, determinism
npm run build      # production build in dist/ (relative URLs; three.js loads only when a 3D screen opens)
npm run check      # typecheck + tests + build + smoke test of the built site (what CI runs)
npx tsx scripts/runall.ts   # regression: reference design of every scenario, flown end to end (scores 860–924)
```

## Playable loop

Briefing → **Workshop** (three.js 3D assembly: orbit the spacecraft, slots glow for compatible parts, drag/drop or click to place,
X-ray interior; schematic and propulsion/power/radiation/redundancy panels) → Instrument Lab → **Orbit Planner** (3D body with
textures, orbit line, eclipse/beta/radiation/decay readouts, LTAN for sun-synchronous orbits) → **Launch Center** (3D vehicle on
the pad at dusk with the real spacecraft inside the fairing, per-destination capacity, strap-on boosters, and for Mars and the asteroid a
**launch-window planner**: C3 versus calendar day, your ready date and the deadline) → **Test Facility** (six
campaigns that cost money and months and lower the matching anomaly probabilities) → Flight readiness review (**GO / NO-GO poll**)
→ **Flight** (autopilot / assist / manual ascent, staging) → **Maneuver node** (injection burn with predicted trajectory) →
Mission control (3D orbit, MET clock, day-by-day ops, anomalies, in-orbit orbit changes, scientific discoveries) → Debrief
(transparent score, failure analysis, counterfactuals by re-simulation).

Also: five scenarios with mission patches, three difficulty levels, a **space-programme mode with a technology tree**, sandbox,
saved blueprints, comparison, local leaderboard, learning center with calculators, and team mode (real same-browser sync; see
`docs/MULTIPLAYER.md`).

## Everyday convenience

* A **Back / Next bar** under every design step says where you are, what to do there and how many launch blockers or warnings remain.
* **Keyboard:** `[` and `]` move between steps, `T` changes theme, `M` toggles the animated background, `+` / `−` change text size, `?` opens the help.
* **Text size** (A− / A+, four steps up to 140 %) and four themes are in the top bar and are remembered.
* First visit shows a short guide to the ten steps; the **?** button reopens it any time.
* Without WebGL the 3D views show an explanation instead of failing; the schematic and every numeric panel keep working.

## Look and feel

Four switchable themes (top bar), each with its own typefaces and palette, all bundled so nothing is fetched at run time:
**Flight console** (original DIN-style look), **Houston graphite** (IBM Plex + Barlow), **Blueprint paper** (light, Source Serif/Sans/Code)
and **Apollo era** (Bebas Neue, Work Sans, Courier Prime in olive and orange). A quiet animated backdrop (parallax stars, blueprint grid,
rocket line drawings, orbiting satellites and an occasional launch) can be switched off with the *motion* toggle and is hidden when the
system asks for reduced motion.

## Reference and progression

* **Technology tree:** 31 technologies in eight branches and four tiers, drawn as a pan/zoom graph with search, branch filters,
  prerequisite/dependent highlighting, a detail panel and a real-world analogue for every node.
* **Catalogue:** 79 parts (24 instruments) from a 12U micro bus to a super-heavy observatory bus.
* **Verification:** 13 test campaigns and 16 anomaly and opportunity types; booked tests lower the matching anomaly odds.
* **Achievements:** 17 milestones judged from every finished mission and remembered in the browser.
* **Real data:** a delta-v map (subway style, with a comparison against your design), 11 real launchers and 11 real missions.

## Design influences

The build-fly-learn loop, staging, maneuver nodes, a technology tree, programme credits and the community delta-v map are familiar from
physics-driven rocket games. They were reimplemented from public gameplay knowledge only (no game code or assets were examined or reused);
all names, art, numbers and rules here are original.

## Design parameters that feed the physics

Orbit altitude/inclination/eccentricity and **local time of ascending node** (sets the beta angle → eclipse length and illumination),
solar-array **drive** (tracking vs fixed), **extra aluminium shielding** (mass vs total ionising dose, with radiation-hardened vs
commercial computers), **cross-strapped redundancy** (computer, transmitter, battery), launch **boosters**, propellant load,
ground stations, data compression, thermal-control class (passive → active, with louvers and heaters), tests to book, and the
**launch day** for interplanetary targets (waiting for a window costs standby money; an early date blocks launch).

## Architecture

```
src/engine   physics, orbitalMechanics (Kepler, beta-angle eclipse, drag, decay, dose), launchWindows, communicationModel, powerModel, thermalModel,
             launch, flightSim (ascent + injection), resourceManager (Analysis), feasibilityValidator, missionSimulator,
             eventEngine, testFacility, scoringEngine, counterfactual, designFactory, rng
src/data     bodies, orbits, spacecraftComponents, instruments, launchVehicles, missions, techTree, tests, discoveries (illustrative numbers)
src/store    store.ts (state, career, persistence), team.ts (transport), audio.ts (synthesised sound)
src/education   topics.ts
src/components  Emblem, RocketStack, Blueprint, Charts, StatusPanel, LaunchWindowPanel,
                three/ (models, textures, planets, env, post, stage, SpacecraftScene, RocketScene, OrbitScene)
src/pages, src/tests
```

All simulation logic is pure TypeScript outside React and is unit tested. `docs/ASSUMPTIONS.md` lists which equations are real
physics, which are approximations, and the known limits.

## Known limits

No internet multiplayer; 2D ascent physics (boosters are pooled into stage 1); simplified link-budget, thermal (lumped single-node)
and radiation (exponential shielding, no particle transport) models; the 3D scenes are procedural (no imported CAD or photo
textures; planets are stylised, not maps of the real bodies; generating the Earth maps takes about a second on first use); sound is synthesised and was not auditioned by the author; leaderboard and programme progress are local to the browser.

## Accessibility checks

Text contrast was audited on every screen in all four themes with `scripts/contrast-audit.js` (WCAG AA: 4.5:1, or 3:1 for large text).
Remaining reports are known false positives: SVG labels drawn on coloured shapes (emblems, rocket stack, delta-v pills) are judged
against the SVG container. The mission clock, schematic board and 3D viewports are dark displays in every theme.

## Deployment

The site is fully static: no server, database or API keys. Everything (fonts, textures, sound) is generated or bundled at build time.

```bash
npm ci
npm run check          # typecheck, 86 tests, production build, smoke test
npm run regress        # optional: fly the reference mission of every scenario end to end
```

| Target | How |
|---|---|
| Netlify / Cloudflare Pages | Connect the repository (`netlify.toml` is included) or drag `dist/` into the dashboard. `public/_headers` adds a strict Content-Security-Policy and cache rules. |
| Vercel | Import the repository; `vercel.json` sets the same headers. |
| GitHub Pages | Push to `main`: `.github/workflows/pages.yml` checks, builds and publishes. Relative URLs make sub-paths work. |
| Docker / any server | `docker build -t mission-control . && docker run -p 8080:80 mission-control` (nginx with security headers), or copy `dist/` to any static host. |
| One file | `npm run build:single` writes `dist-single/index.html` (about 2.4 MB, scripts, styles and fonts inlined) for hosts that accept a single page. |

Production notes: no source maps are published; progress, blueprints, the leaderboard, theme and achievements live in the visitor's browser
storage only (nothing is sent anywhere); team mode synchronises tabs of one browser, not computers. See `THIRD_PARTY.md` for licences.
