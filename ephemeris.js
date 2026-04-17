/**
 * ephemeris.js  –  Venus phase ephemeris
 * VSOP87 truncated series (Meeus "Astronomical Algorithms" Ch.32-33)
 * τ = Julian millennia from J2000.0
 */
"use strict";

const RAD = Math.PI / 180;
const AU_KM = 149597870.7;
const VENUS_RADIUS_KM = 6051.8;

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Σ A·cos(B + C·τ) for one power row
function vsopSum(row, tau) {
  let s = 0;
  for (const [A, B, C] of row) s += A * Math.cos(B + C * tau);
  return s;
}

// Full polynomial: Σ_n  τ^n · (row_n sum)  then divide by 1e8
function vsopPoly(rows, tau) {
  let result = 0, tauPow = 1;
  for (const row of rows) { result += tauPow * vsopSum(row, tau); tauPow *= tau; }
  return result / 1e8;
}

// ── Earth VSOP87 ─────────────────────────────────────────────────────────
const EL = [
  [[175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261,12566.1517],
   [3497,2.7441,5753.3849],[3418,2.8289,3.5231],[3136,3.6277,77713.7715],
   [2676,4.4181,7860.4194],[2343,6.1352,3930.2097],[1324,0.7425,11506.7698],
   [1273,2.0371,529.691],[1199,1.1096,1577.3435],[990,5.233,5884.927],
   [902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],
   [753,2.533,5507.553],[505,4.583,18849.228],[492,4.205,775.523],
   [357,2.920,0.067],[317,5.849,11790.629],[284,1.899,796.298],
   [271,0.315,10977.079],[243,0.345,5486.778],[206,4.806,2544.314],
   [205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299]],
  [[628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],
   [425,1.590,3.523],[119,5.796,26.298],[109,2.966,1577.344],
   [93,2.59,18849.23],[72,1.14,529.69],[68,1.87,398.15],
   [67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],
   [45,0.40,796.30],[36,0.47,775.52],[29,2.65,7.11],[21,5.34,0.98]],
  [[52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],
   [27,0.05,3.52],[16,5.19,26.30],[16,3.68,155.42],
   [10,0.76,18849.23],[9,2.06,77713.77],[7,0.83,775.52]],
  [[289,5.844,6283.076],[35,0,0],[17,5.49,12566.15]],
  [[114,3.1416,0],[8,4.13,6283.08]],
  [[1,3.14,0]]
];
const EB = [
  [[280,3.199,84334.662],[102,5.422,5507.553],[80,3.88,5223.69],
   [44,3.70,2352.87],[32,4.00,1577.34]]
];
const ER = [
  [[100013989,0,0],[1670700,3.0984635,6283.07585],[13956,3.05525,12566.1517],
   [3084,5.1985,77713.7715],[1628,1.1739,5753.3849],[1576,2.8469,7860.4194],
   [925,5.453,11506.770],[542,4.564,3930.210],[472,3.661,5884.927],
   [346,0.964,5507.553],[329,5.900,5223.694],[307,0.299,5573.143],
   [243,4.273,11790.629],[212,5.847,1577.344],[186,5.022,10977.079],
   [175,3.012,18849.228],[110,5.055,5486.778]],
  [[103019,1.107490,6283.075850],[1721,1.0644,12566.1517],[702,3.142,0],
   [32,1.02,18849.23],[31,2.84,5507.55],[25,1.32,5223.69]],
  [[4359,5.7846,6283.0758],[124,5.579,12566.152],[12,3.14,0]],
  [[145,4.273,6283.076],[7,3.92,12566.15]],
  [[4,2.56,6283.08]]
];

// ── Venus VSOP87 ─────────────────────────────────────────────────────────
const VL = [
  [[317614667,0,0],[1353968,5.5931332,10213.2855462],[89892,5.30650,20426.57109],
   [5477,4.4163,7860.4194],[3456,2.6996,11790.6291],[2372,2.9938,3930.2097],
   [1664,4.2502,1577.3435],[1438,4.1575,9153.9038],[1317,5.1867,26.2983],
   [1201,6.1536,30213.5316],[761,1.950,529.691],[708,1.065,775.523],
   [585,3.998,191.448],[500,4.123,15720.839],[429,3.586,19367.189],
   [327,5.677,5507.553],[326,4.591,10404.734],[232,3.163,9437.763],
   [180,4.653,10239.584],[155,5.570,1109.379],[128,4.226,20.775],
   [128,0.962,5661.332],[106,1.537,801.821]],
  [[1021352943052,0,0],[95708,2.46424,10213.28555],[14445,0.51625,20426.57109],
   [213,1.795,30639.857],[174,2.655,26.298],[152,6.106,1577.344],
   [82,5.70,191.45],[70,2.68,9153.90],[52,3.60,15720.84],
   [38,1.03,9437.76],[30,1.25,19367.19],[25,6.11,10404.73]],
  [[54127,0,0],[3891,0.3451,10213.2855],[1338,2.0201,20426.5711],
   [24,2.05,26.30],[19,3.54,30639.86],[10,3.97,775.52]],
  [[136,4.804,10213.286],[78,3.67,20426.57],[26,0,0]],
  [[114,3.1416,0],[3,5.21,20426.57],[2,2.51,10213.29]],
  [[1,3.14,0]]
];
const VB = [
  [[5923638,0.2670278,10213.2855462],[40108,1.14737,20426.57109],
   [32815,3.14737,0],[1011,1.0895,30639.857],[149,6.254,18073.705],
   [138,0.860,1577.344],[130,3.672,9153.904],[120,3.705,2352.866],
   [108,4.539,22003.915]],
  [[513348,1.803643,10213.285546],[4380,3.3862,20426.5711],[199,0,0],[197,2.530,30639.857]],
  [[22378,3.38509,10213.28555],[282,0,0],[173,5.256,20426.571]],
  [[647,4.992,10213.286],[20,3.14,0]],
  [[14,0.32,10213.29]]
];
const VR = [
  [[72334821,0,0],[489824,4.021518,10213.285546],[1658,4.9021,20426.5711],
   [1632,2.8455,7860.4194],[1378,1.1285,11790.6291],[498,2.587,9153.904],
   [374,1.423,3930.210],[264,5.529,9437.763],[237,2.552,15720.839],
   [222,2.013,19367.189],[126,2.728,1109.379],[119,3.020,10239.584]],
  [[34551,0.89199,10213.28555],[234,1.772,20426.571],[234,3.142,0]],
  [[1407,5.0637,10213.2855],[16,5.47,20426.57],[13,0,0]],
  [[50,3.22,10213.29]],
  [[1,0.92,10213.29]]
];

// Mean obliquity (Meeus, degrees→radians)
function obliquity(T) {
  return (84381.448 - 4680.93*T - 1.55*T*T + 1999.25*T*T*T
    - 51.38*Math.pow(T,4) - 249.67*Math.pow(T,5)
    - 39.05*Math.pow(T,6) + 7.12*Math.pow(T,7)
    + 27.87*Math.pow(T,8) + 5.79*Math.pow(T,9)
    + 2.45*Math.pow(T,10)) / 3600 * RAD;
}

function mod2pi(x) { x = x % (2*Math.PI); return x < 0 ? x + 2*Math.PI : x; }

// ── Main computation ──────────────────────────────────────────────────────
function computeVenusPhase(date) {
  const jd  = julianDate(date);
  const T   = (jd - 2451545.0) / 36525;
  const tau = T / 10;   // Julian millennia

  // Heliocentric ecliptic L, B, R
  const eL = mod2pi(vsopPoly(EL, tau));
  const eB = vsopPoly(EB, tau);
  const eR = vsopPoly(ER, tau);

  const vL = mod2pi(vsopPoly(VL, tau));
  const vB = vsopPoly(VB, tau);
  const vR = vsopPoly(VR, tau);

  // Heliocentric rectangular (ecliptic)
  const Ex = eR * Math.cos(eB) * Math.cos(eL);
  const Ey = eR * Math.cos(eB) * Math.sin(eL);
  // const Ez = eR * Math.sin(eB);   // negligible for this purpose

  const Vx = vR * Math.cos(vB) * Math.cos(vL);
  const Vy = vR * Math.cos(vB) * Math.sin(vL);
  // const Vz = vR * Math.sin(vB);

  // Geocentric rectangular
  const dx = Vx - Ex;
  const dy = Vy - Ey;
  const Delta = Math.sqrt(dx*dx + dy*dy);  // Earth–Venus distance (AU, 2D is fine for phase)

  // More accurate 3D distance
  const Ez = eR * Math.sin(eB);
  const Vz = vR * Math.sin(vB);
  const dz = Vz - Ez;
  const Delta3 = Math.sqrt(dx*dx + dy*dy + dz*dz);

  // Phase angle (Sun–Venus–Earth), law of cosines
  const cosI = (vR*vR + Delta3*Delta3 - eR*eR) / (2 * vR * Delta3);
  const phaseAngleRad = Math.acos(Math.max(-1, Math.min(1, cosI)));
  const phaseAngleDeg = phaseAngleRad / RAD;

  // Illuminated fraction
  const illumination = (1 + Math.cos(phaseAngleRad)) / 2 * 100;

  // Elongation (Sun–Earth–Venus)
  const cosEl = (eR*eR + Delta3*Delta3 - vR*vR) / (2 * eR * Delta3);
  const elongation = Math.acos(Math.max(-1, Math.min(1, cosEl))) / RAD;

  // Angular diameter (arcseconds)
  const angularSize = 2 * Math.atan2(VENUS_RADIUS_KM, Delta3 * AU_KM) / RAD * 3600;

  // Geocentric longitude of Venus and geocentric Sun
  const geocVenusLon = mod2pi(Math.atan2(dy, dx));
  const sunGeoLon    = mod2pi(eL + Math.PI);

  // East vs West elongation → which limb is lit
  let lonDiff = geocVenusLon - sunGeoLon;
  if (lonDiff >  Math.PI) lonDiff -= 2*Math.PI;
  if (lonDiff < -Math.PI) lonDiff += 2*Math.PI;
  // Eastern elongation (lonDiff > 0): Venus east of Sun, sets after Sun, lit on RIGHT
  const isEastern = lonDiff > 0;

  let phaseName;
  if      (phaseAngleDeg < 18)  phaseName = "Full";
  else if (phaseAngleDeg < 72)  phaseName = "Gibbous";
  else if (phaseAngleDeg < 108) phaseName = "Quarter";
  else if (phaseAngleDeg < 162) phaseName = "Crescent";
  else                          phaseName = "New";

  return {
    jd,
    illumination,
    phaseAngleDeg,
    elongation,
    distanceAU: Delta3,
    angularSize,
    phaseName,
    isEastern,
    venusEclLon: vL / RAD,
    earthEclLon: eL / RAD,
    venusR: vR,
    earthR: eR
  };
}

window.Ephemeris = { computeVenusPhase };
