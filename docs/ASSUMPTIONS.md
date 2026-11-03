# Model assumptions: what is real, what is approximated

All component, instrument and launch-vehicle numbers are **illustrative game-balance values**, not claims about real hardware.
Launch vehicles are fictional.

## Real physical equations used
| Topic | Equation | Where |
|---|---|---|
| Orbital period | `T = 2π√(a³/μ)` with the μ of the *correct* body (Earth, Moon, Mars, asteroid, Sun) | `engine/orbitalMechanics.ts` |
| Orbital speed / vis-viva | `v = √(μ(2/r − 1/a))` | `engine/physics.ts` |
| Hohmann transfer, plane change | `Δv = 2 v sin(Δi/2)` | `orbitalMechanics.ts` |
| Hyperbolic capture burn | `√(v∞² + 2μ/r_p) − v_orbit(r_p)` | `captureDv` |
| Sun-synchronous inclination | `cos i = −(a / 12352 km)^3.5` | `sunSyncInclinationDeg` |
| Rocket equation | `Δv = Isp g₀ ln(m₀/m_f)` | `physics.ts`, `launch.ts`, `flightSim.ts` |
| Gravity | `g = μ/r²`, `F = m a` | `flightSim.ts` |
| Free-space path loss | `20 log₁₀(4π d f / c)` | `communicationModel.ts` |
| Dish gain / beamwidth / pointing loss | `G = η(πD/λ)²`, `θ ≈ 70λ/D`, `L = 12(e/θ)² dB` | `communicationModel.ts` |
| Solar power vs distance | inverse square law | `powerModel.ts` |
| Battery | modelled as **energy (Wh)**; eclipse energy = load × time | `powerModel.ts` |

## Game approximations (clearly simplified)
* **Link budget:** single modulation, fixed coding gain (Eb/N0 4.5 dB), fixed 2 dB misc. loss, no weather, no detailed noise model. Not a professional RF analysis.
* **Ground contact:** time-averaged visibility from a spherical-cap model (Earth) or occultation + tracking hours (other bodies).
* **Coverage:** swath × ground speed, with Poisson random-overlap statistics (conservative: real mapping orbits are systematic). Latitude reach is limited by inclination.
* **Launch capacity:** computed per destination from stage data with the rocket equation. One calibrated constant (9,420 m/s) represents ascent losses; it was measured with the in-game flight simulator. Stage-1 Isp is a blend of sea-level and vacuum values.
* **Flight simulation:** planar (2D) powered ascent, exponential atmosphere, Cd curve, symplectic Euler at dt = 0.1 s, no winds or oblateness. The autopilot is a gravity turn followed by altitude-hold guidance; the pitch kick is tuned per vehicle and payload. The 200 km parking orbit is flown; the later injection burn is evaluated analytically (remaining upper-stage Δv vs required Δv).
* **Orbit preview:** impulsive burn at an apsis with two-body vis-viva; a propagation helper uses RK4.
* **Power:** daily energy balance in Wh with load shedding, eclipse brown-out factor and battery wear; no orbit-by-orbit simulation.
* **Thermal:** lumped model (heat to reject vs rejection capacity, plus a stability index for sensitive instruments).
* **Events:** seeded probabilities that depend on the design (power margin, thermal margin, radiation environment, complexity, navigation sensors) and on difficulty.
* **Asteroid "2026 NS-1"** is fictional (Bennu-sized).

## Determinism
All randomness comes from `engine/rng.ts` (hashed, per-day streams). The same design + scenario + difficulty + seed (+ the same player actions) reproduces the identical mission.

## Scoring
`1000 × (0.35 science + 0.20 reliability + 0.15 resource efficiency + 0.10 budget efficiency + 0.10 operations + 0.10 objectives)`, all components normalised 0-1.
Caps: failed launch ≤ 120, failed insertion ≤ 249, spacecraft lost ≤ 449, any failed mandatory objective ≤ 649.

## Added in the second iteration
* **Strap-on boosters** are merged into stage 1: thrust and propellant add, Isp is the mass-flow-weighted mean, diameter grows with the square root of summed areas, and everything is dropped at stage-1 separation (real boosters usually burn out earlier).
* **Injection planner:** impulsive prograde burns applied to the simulated state, upper-stage propellant consumed with the rocket equation, RK4 coasting to apsides. Target checks use real orbital quantities: apoapsis radius (translunar, L2, GTO), final periapsis/apoapsis (direct orbits) or C3 = v² − 2μ/r (interplanetary).
* **GO / NO-GO poll:** each console reports the worst severity of the validator issues mapped to its system (CRITICAL = NO-GO, WARNING = CAUTION).
* **Programme mode:** hardware outside the starter set must be researched; credits = score / 8 + first-completion and improvement bonuses. Game-balance values only.
* **Sound** is synthesised with the Web Audio API at runtime (no files), starts after a user gesture and can be switched off.

## Added in the third iteration (realism pass)
* **Eclipse from the beta angle:** the eclipse fraction is `acos(√(h² + 2Rh) / ((R + h) cos β)) / π` and is zero once `|β|` exceeds the critical angle `asin(R/(R+h))`. For sun-synchronous orbits the local time of the ascending node (LTAN) sets β (dawn-dusk ≈ 6 h gives no eclipse, noon gives the longest). Illumination also follows the angle between the orbit plane and the Sun.
* **Atmospheric drag:** `a = ½ ρ v² Cd A / m` with a log-interpolated density table (mean solar activity, no day/night or solar-cycle variation). It gives station-keeping Δv per year and an orbit-lifetime integral; drag area comes from the real frame and array areas.
* **Radiation:** total ionising dose per year by orbit (illustrative values shaped like the belts), attenuated exponentially with aluminium thickness (about ×10 per 3.5 mm beyond the 2.5 mm baseline structure). Computers have a hardness `tidKrad`; the validator applies a factor-of-two design margin. No single-event or displacement-damage modelling beyond the event probabilities.
* **Array drive:** sun-tracking drives use an angle factor of 0.95, fixed arrays 0.68 (further multiplied by 0.87 when there is no attitude control). Fixed arrays save drive mass and power but generate less.
* **Redundancy:** a cold spare of the computer or transmitter costs its mass and cost (plus a little power) and gives that unit reliability `1 − (1 − r)²`; the first computer or transmitter fault in operations is absorbed by the spare. Battery redundancy is modelled as 10 % extra cells (mass and cost) with the same parallel-reliability formula. No common-cause failures.
* **Thermal balance:** one lumped node per case. Hot case: absorbed sunlight + albedo + planet infrared + dissipation; cold case: eclipse with minimum dissipation. The radiator is sized to reject the thermal part's `heatRejectionW` at 300 K (`A = rej / 390 W/m²`) and temperature follows `T = 300·(Q/(rej·s))^¼` where `s` is the louver setting; heater power is whatever keeps the battery at 0 °C and is added to the power budget. Louver turn-down values (0.25 / 0.08) are game parameters.
* **Structure:** axial and lateral fundamental frequencies from `f = (1/2π)√(k/m)` with a stiffness per frame class; quasi-static load factor from the launcher; reported margin is against the frame ultimate with a safety factor of 1.4.
* **Test facility:** six campaigns (power profile, thermal-vacuum, vibration, RF, deployment, static fire) run the same analysis as the validator and report measured margins plus findings. Booking a test adds its cost and months and multiplies the matching anomaly probabilities by 0.5–0.8; it does not change the physics of the design.
* **Orbit changes in operations:** impulsive Hohmann transfer between the current and a new circular altitude, Δv from vis-viva, propellant from the rocket equation using the part's Isp; refused if the tank cannot supply it.
* **Discoveries:** milestone events keyed to cumulative returned science points in each domain; narrative only: a discovery is logged once the points returned by instruments of the matching science domain reach a threshold; it does not feed the score directly.
* **Launch capacity** is computed per destination from the stage data (ascent Δv 9 420 m/s calibrated against the 2D flight simulation, plus a 120 m/s reserve) rather than from a table.
* **3D scenes (three.js):** all geometry and textures are procedural (canvas textures, no files). Planet textures are stylised, not maps of the real bodies; the Sun direction, orbit line, satellite scale and planet-to-orbit ratio are drawn to scale for the chosen orbit but spacecraft and rocket sizes are exaggerated for visibility.

## Added in the fourth iteration (launch windows and graphics)
* **Launch windows (Mars, asteroid):** the departure energy follows a raised cosine around each window centre, C3(day) = C3_best + span · (1 − cos(2π (day − centre) / T_syn)) / 2, with T_syn = 780 d (Mars) and 640 d (fictional asteroid). The span (26 and 20 km²/s²) and the centre days are game parameters; real porkchop plots are two-dimensional (departure and arrival date) and asymmetric. The launcher's parking-orbit-to-departure delta-v is recomputed from C3 (v = √(2μ/r + C3) − v_circ), so payload capacity falls off-window; arrival delta-v grows by 28 % (Mars) or 35 % (asteroid) at the worst date. A date is "inside the window" while the C3 excess stays within 8 % of the span.
* **Launch day and schedule:** the player picks a calendar day. If the programme (development, tests, launcher lead time) is not ready by then the design is blocked; waiting past "ready" costs $0.7M per month of standby. The next window after a missed one is a full synodic period later, which is normally beyond the scenario deadline.
* **Graphics:** HDR rendering with a bloom pass; reflections come from an image-based light built from a hard Sun and blue Earth-shine (orbit) or a dusk sky (launch pad). Planets are generated at run time from 3-D noise on the sphere. Earth uses a custom shader (day/night terminator with a warm twilight band, ocean glint, city lights, cloud layer, Rayleigh-style limb glow); Moon and Mars use albedo plus bump maps with procedural craters; the asteroid is a displaced mesh. None of this changes the simulation.

## Added in the fifth iteration (catalogue, tests, themes)
* **Catalogue:** all 32 new parts use the same illustrative-values caveat as the originals. They follow real families (cubesat buses, Hall and ion thrusters, Ka-band links, radiation-hardened computers, control moment gyros, cryocoolers, SAR, gamma-ray and X-ray spectrometers, plasma and dust analysers, a cooled infrared telescope) but their numbers are game-balance values.
* **Radiation-hardened computers** matter through single-event upsets, not total dose: the weakest-link total-dose tolerance of the spacecraft is capped (60 krad), so a 300 krad and a 1,000 krad computer have the same dose margin; the upset event weight is ×1.5 below 100 krad, ×0.55 from 100 krad and ×0.2 from 300 krad.
* **New tests** (EMC, acoustic, radiation, optical, software, life, end-to-end) are simple screening models with game thresholds. Their anomaly reductions are multipliers on the daily event probability (for example ×0.6 for computer faults after a radiation test); the end-to-end test lowers every anomaly type by a further 10 %.
* **New events:** single-event upset, reaction-wheel friction, star-tracker blinding, micrometeoroid strike. They only use existing mission modifiers (safe mode, load shedding, navigation penalty, buffered data), so no new physics is involved.
* **Technology-tree analogues and the Real data page** quote rounded figures from public documentation (for example Landsat 8 OLI bands, Cassini's main-engine burn, Falcon Heavy and Saturn V payloads, the community delta-v map). They are for orientation; consult official sources for exact values.
* **Achievements** are pure functions of the finished mission; thresholds are chosen for fun.
