// Real physical equations (SI). Game approximations live in the other engine modules and are labelled there.

export const G0 = 9.80665;               // m/s^2 standard gravity
export const AU = 1.495978707e11;        // m
export const C_LIGHT = 299792458;        // m/s
export const K_B = 1.380649e-23;         // J/K
export const SOLAR_CONSTANT = 1361;      // W/m^2 at 1 AU
export const DAY = 86400;                // s
export const YEAR_DAYS = 365.25;

export const dbToLin = (db: number) => Math.pow(10, db / 10);
export const linToDb = (x: number) => 10 * Math.log10(Math.max(x, 1e-300));
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;

/** g = mu / r^2 */
export const gravAccel = (mu: number, r: number) => mu / (r * r);
/** v_circ = sqrt(mu / r) */
export const circularSpeed = (mu: number, r: number) => Math.sqrt(mu / r);
/** v_esc = sqrt(2 mu / r) */
export const escapeSpeed = (mu: number, r: number) => Math.sqrt((2 * mu) / r);
/** vis-viva: v = sqrt(mu (2/r - 1/a)) */
export const visViva = (mu: number, r: number, a: number) => Math.sqrt(Math.max(0, mu * (2 / r - 1 / a)));

/** Tsiolkovsky rocket equation: dv = Isp * g0 * ln(m0 / mf) */
export function tsiolkovskyDv(isp: number, m0: number, mf: number): number {
  if (mf <= 0 || m0 <= mf) return 0;
  return isp * G0 * Math.log(m0 / mf);
}
/** Propellant needed to produce dv with final (burnout) mass mf: mp = mf (e^(dv/(Isp g0)) - 1) */
export function propellantForDv(dv: number, isp: number, finalMassKg: number): number {
  return finalMassKg * (Math.exp(dv / (isp * G0)) - 1);
}
/** Propellant burned by a dv starting at mass m0: mp = m0 (1 - e^(-dv/(Isp g0))) */
export function propellantUsed(dv: number, isp: number, m0: number): number {
  return m0 * (1 - Math.exp(-dv / (isp * G0)));
}
