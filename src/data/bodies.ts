import type { Body, BodyId } from '../types';

// mu and radius: published values. The asteroid is FICTIONAL ("2026 NS-1", Bennu-sized).
export const BODIES: Record<BodyId, Body> = {
  earth: { id: 'earth', name: 'Earth', mu: 3.986004418e14, radius: 6.371e6, sunDistanceAU: 1.0, color: '#1650b8', atmosphereKm: 100 },
  moon: { id: 'moon', name: 'Moon', mu: 4.9048695e12, radius: 1.7374e6, sunDistanceAU: 1.0, color: '#9aa3ad', atmosphereKm: 0 },
  mars: { id: 'mars', name: 'Mars', mu: 4.282837e13, radius: 3.3895e6, sunDistanceAU: 1.524, color: '#c1440e', atmosphereKm: 120 },
  asteroid: { id: 'asteroid', name: '2026 NS-1 (fictional asteroid)', mu: 5.2, radius: 250, sunDistanceAU: 1.12, color: '#6b6258', atmosphereKm: 0 },
  sun: { id: 'sun', name: 'Sun', mu: 1.32712440018e20, radius: 6.957e8, sunDistanceAU: 0, color: '#f6c453', atmosphereKm: 0 },
};

export const EARTH_ROTATION_RATE = 7.2921159e-5; // rad/s
export const EARTH_SURFACE_SPEED = 465.1;         // m/s at the equator
export const LAUNCH_SITE_LAT_DEG = 28.5;
export const PARKING_ALT_M = 200e3;               // launcher parking orbit
