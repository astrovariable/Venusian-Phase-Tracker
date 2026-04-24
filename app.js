/**
 * app.js  –  Venus Phase Renderer (corrected)
 *
 * Phase drawing strategy (no offscreen canvas, no compositing issues):
 *   The illuminated portion of Venus is bounded by:
 *     - A semicircle arc on the "lit" side  (the outer limb)
 *     - An ellipse arc for the terminator   (semi-minor = R·cos(phaseAngle))
 *
 *   We build a single closed path and fill it.
 *   For crescent (phase > 90°): terminator ellipse bulges INTO the lit side → narrow sliver
 *   For gibbous  (phase < 90°): terminator ellipse bulges INTO the dark side → wide lit area
 */
"use strict";

// ── Helpers ───────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(n, d) { return n.toFixed(d); }
const TWO_PI = Math.PI * 2;

// ── DPR-aware canvas setup ─────────────────────────────────────────────────
function setupCanvas(id, cssW, cssH) {
  const el  = document.getElementById(id);
  const dpr = window.devicePixelRatio || 1;
  el.width  = Math.round(cssW * dpr);
  el.height = Math.round(cssH * dpr);
  el.style.width  = cssW + 'px';
  el.style.height = cssH + 'px';
  const ctx = el.getContext('2d');
  ctx.scale(dpr, dpr);
  return { el, ctx, W: cssW, H: cssH, dpr };
}

const vCanvas = setupCanvas('venus-canvas',    260, 260);
const gCanvas = setupCanvas('geometry-canvas', 340, 340);

// ── Starfield ──────────────────────────────────────────────────────────────
(function () {
  const sf  = document.getElementById('starfield');
  const ctx = sf.getContext('2d');
  let stars = [], W, H;

  function resize() {
    W = sf.width  = window.innerWidth;
    H = sf.height = window.innerHeight;
    stars = Array.from({ length: 320 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.07 ? Math.random() * 1.4 + 0.6
       : Math.random() < 0.35 ? Math.random() * 0.7 + 0.2
       : Math.random() * 0.35 + 0.1,
      a:  Math.random() * 0.55 + 0.2,
      sp: Math.random() * 0.0018 + 0.0004,
      ph: Math.random() * TWO_PI,
      warm: Math.random() < 0.12,
    }));
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t++;
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(t * s.sp * 60 + s.ph);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.warm ? '#ffe090' : '#ddeeff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}());

// ── Venus phase disk ───────────────────────────────────────────────────────
//
// Rendering strategy: two nested ctx.clip() regions, no path winding issues.
//
// The lit region is the intersection of:
//   Clip A  – lit semicircle of the outer disk (left or right half)
//   Clip B  – gibbous: the region OUTSIDE the terminator ellipse on the lit side
//             crescent: the region INSIDE  the terminator ellipse on the lit side
//
// Terminator ellipse: rx = R·|cos(i)|, ry = R, centred at (cx, cy).
//   i < 90° → gibbous (more than half lit): ellipse is narrow, keep outside it
//   i > 90° → crescent (less than half lit): ellipse is narrow, keep inside it
//   i = 90° → quarter: rx = 0, straight terminator line
//
function drawVenusPhase(phaseAngleDeg, isEastern) {
  const { ctx, W, H } = vCanvas;
  const cx = W / 2, cy = H / 2;
  const R  = W * 0.42;

  ctx.clearRect(0, 0, W, H);

  // ── 1. Dark sphere ────────────────────────────────────────────────────
  const darkG = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
  darkG.addColorStop(0,   '#1c1a38');
  darkG.addColorStop(0.5, '#0d0c1e');
  darkG.addColorStop(1,   '#060410');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TWO_PI);
  ctx.fillStyle = darkG;
  ctx.fill();

  if (phaseAngleDeg >= 179.5) { _drawLimb(ctx, cx, cy, R); return; }

  // Full Venus – entire disk lit, skip clip logic
  if (phaseAngleDeg <= 0.5) {
    const fullG = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    fullG.addColorStop(0.0, '#5a2808'); fullG.addColorStop(0.4, '#c07028');
    fullG.addColorStop(0.7, '#ffec90'); fullG.addColorStop(1.0, '#ffffff');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.fillStyle = fullG; ctx.fill();
    _drawLimb(ctx, cx, cy, R); return;
  }

  const i  = phaseAngleDeg * Math.PI / 180;
  const rx = R * Math.abs(Math.cos(i));   // terminator ellipse x-radius, always ≥ 0
  // Gibbous: i strictly < 90°. Quarter and crescent use the crescent (inside-ellipse) clip.
  const isGibbous = i < Math.PI / 2 - 0.001;

  // Lit side: eastern = right (+x), western = left (-x)
  // Semicircle angle range for the lit side:
  //   right: from -PI/2 → +PI/2 clockwise (false)
  //   left:  from +PI/2 → -PI/2 clockwise (false)  = from PI/2 going CW past PI → 3PI/2
  const litArcStart = isEastern ? -Math.PI / 2 :  Math.PI / 2;
  const litArcEnd   = isEastern ?  Math.PI / 2 : -Math.PI / 2;

  // ── 2. Surface gradient: dark→bright across disk, bright on lit side ──
  const gradX0 = isEastern ? cx - R : cx + R;   // dark edge x
  const gradX1 = isEastern ? cx + R : cx - R;   // bright edge x
  const grad = ctx.createLinearGradient(gradX0, cy, gradX1, cy);
  grad.addColorStop(0.00, '#060410');
  grad.addColorStop(0.28, '#5a2808');
  grad.addColorStop(0.52, '#b86820');
  grad.addColorStop(0.70, '#ecb040');
  grad.addColorStop(0.85, '#ffec90');
  grad.addColorStop(1.00, '#ffffff');

  // ── 3. Clip A – lit semicircle of the outer disk ──────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, litArcStart, litArcEnd, false);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.clip();

  if (isGibbous) {
    // ── Clip B (gibbous): exclude the dark-side region of the terminator ellipse.
    // The terminator ellipse separates lit from dark. On the dark side of the disk,
    // the ellipse extends out. We need everything on the LIT side of it.
    // = full lit semicircle MINUS the part of the ellipse that is on the lit side.
    // The lit side of the ellipse is a semicircle of rx width on the lit x-side.
    // Apply even-odd: lit semicircle rect XOR terminator ellipse lit half = correct region.
    ctx.beginPath();
    // Large rect covering the lit half
    if (isEastern) {
      ctx.rect(cx, cy - R - 2, R + 2, 2 * R + 4);
    } else {
      ctx.rect(cx - R - 2, cy - R - 2, R + 2, 2 * R + 4);
    }
    // Terminator ellipse lit-side half (inside this, things get XORed out)
    ctx.ellipse(cx, cy, rx, R, 0, litArcStart, litArcEnd, false);
    ctx.closePath();
    ctx.clip('evenodd');

  } else {
    // ── Clip B (crescent): keep only the region INSIDE the terminator ellipse on the lit side.
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, R, 0, litArcStart, litArcEnd, false);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.clip();
  }

  // ── 4. Fill full disk with lit gradient – clips carve the shape ───────
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TWO_PI);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();

  // ── 5. Atmospheric limb glow ──────────────────────────────────────────
  const limb = ctx.createRadialGradient(cx, cy, R * 0.80, cx, cy, R * 1.07);
  limb.addColorStop(0,    'transparent');
  limb.addColorStop(0.6,  'rgba(210,140,40,0.04)');
  limb.addColorStop(1,    'rgba(255,175,55,0.24)');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.07, 0, TWO_PI);
  ctx.fillStyle = limb;
  ctx.fill();

  // ── 6. Disk edge ring ─────────────────────────────────────────────────
  _drawLimb(ctx, cx, cy, R);
}

function _drawLimb(ctx, cx, cy, R) {
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(220,180,100,0.20)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ── Geometry diagram ───────────────────────────────────────────────────────
function drawGeometry(data) {
  const { ctx, W, H } = gCanvas;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const sc = (W * 0.41) / 1.05;     // AU → px

  const eOrb = 1.000 * sc;
  const vOrb = 0.723 * sc;

  // Dashed orbit circles
  function orbitRing(r, col) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  orbitRing(eOrb, 'rgba(120,175,230,0.22)');
  orbitRing(vOrb, 'rgba(220,190,90,0.22)');

  const eRad = data.earthEclLon * Math.PI / 180;
  const vRad = data.venusEclLon * Math.PI / 180;

  // Heliocentric positions
  const Ex = cx + eOrb * Math.cos(eRad);
  const Ey = cy - eOrb * Math.sin(eRad);
  const Vx = cx + vOrb * Math.cos(vRad);
  const Vy = cy - vOrb * Math.sin(vRad);

  // ── Sun ──────────────────────────────────────────────────────────────
  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
  sg.addColorStop(0,   '#ffffff');
  sg.addColorStop(0.3, '#ffe060');
  sg.addColorStop(1,   'transparent');
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TWO_PI);
  ctx.fillStyle = sg; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TWO_PI);
  ctx.fillStyle = '#ffe060'; ctx.fill();

  // ── Connector lines ───────────────────────────────────────────────────
  ctx.save();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(255,220,80,0.25)';
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(Vx,Vy); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,190,255,0.25)';
  ctx.beginPath(); ctx.moveTo(Ex,Ey); ctx.lineTo(Vx,Vy); ctx.stroke();
  ctx.restore();

  // ── Earth ─────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(80,160,255,0.55)';
  ctx.shadowBlur  = 10;
  const eg = ctx.createRadialGradient(Ex-2, Ey-2, 0, Ex, Ey, 7);
  eg.addColorStop(0, '#c8e8ff'); eg.addColorStop(1, '#2060a0');
  ctx.beginPath(); ctx.arc(Ex, Ey, 6, 0, TWO_PI);
  ctx.fillStyle = eg; ctx.fill();
  ctx.restore();

  // ── Venus ─────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(240,200,90,0.65)';
  ctx.shadowBlur  = 14;
  const vg = ctx.createRadialGradient(Vx-2, Vy-2, 0, Vx, Vy, 6);
  vg.addColorStop(0, '#fff8d0'); vg.addColorStop(0.5, '#e8c060'); vg.addColorStop(1, '#a06010');
  ctx.beginPath(); ctx.arc(Vx, Vy, 5, 0, TWO_PI);
  ctx.fillStyle = vg; ctx.fill();
  ctx.restore();

  // ── Labels ────────────────────────────────────────────────────────────
  ctx.font = '11px Inconsolata, monospace';
  ctx.fillStyle = 'rgba(140,190,240,0.85)'; ctx.fillText('⊕ Earth', Ex + 9,  Ey - 5);
  ctx.fillStyle = 'rgba(240,200,90,0.90)';  ctx.fillText('♀ Venus', Vx + 8,  Vy - 5);
  ctx.fillStyle = 'rgba(255,220,70,0.90)';  ctx.fillText('☀ Sun',   cx  + 10, cy - 8);

  // Phase angle arc at Venus vertex
  if (data.elongation > 3) {
    const toSun   = Math.atan2(cy - Vy, cx - Vx);
    const toEarth = Math.atan2(Ey - Vy, Ex - Vx);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,60,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(Vx, Vy, 20, toSun, toEarth, false);
    ctx.stroke();
    ctx.restore();
  }
}

// ── DOM refs ───────────────────────────────────────────────────────────────
const elClock   = document.getElementById('utc-clock');
const elIllum   = document.getElementById('val-illumination');
const elPhase   = document.getElementById('val-phase-name');
const elElong   = document.getElementById('val-elongation');
const elDist    = document.getElementById('val-distance');
const elAngle   = document.getElementById('val-angle');
const elAngular = document.getElementById('val-angular');
const elJD      = document.getElementById('jd-display');
const tlFill    = document.getElementById('timeline-fill');
const tlThumb   = document.getElementById('timeline-thumb');

// ── Main tick ──────────────────────────────────────────────────────────────
let lastSec = -1;

function tick() {
  const now = new Date();

  // UTC clock – update every frame (cheap string op)
  elClock.textContent =
    pad(now.getUTCHours())   + ':' +
    pad(now.getUTCMinutes()) + ':' +
    pad(now.getUTCSeconds()) + ' UTC';

  // Ephemeris + render – every second only
  const sec = Math.floor(now.getTime() / 1000);
  if (sec !== lastSec) {
    lastSec = sec;

    const d = Ephemeris.computeVenusPhase(now);

    elIllum.textContent   = fmt(d.illumination,  1);
    elPhase.textContent   = d.phaseName;
    elElong.textContent   = fmt(d.elongation,    2);
    elDist.textContent    = fmt(d.distanceAU,    4);
    elAngle.textContent   = fmt(d.phaseAngleDeg, 2);
    elAngular.textContent = fmt(d.angularSize,   1);
    elJD.textContent      = fmt(d.jd,            4);

    // Timeline bar: 0 % = new (180°), 100 % = full (0°)
    const pct = (1 - d.phaseAngleDeg / 180) * 100;
    tlFill.style.width = pct + '%';
    tlThumb.style.left = pct + '%';

    drawVenusPhase(d.phaseAngleDeg, d.isEastern);
    drawGeometry(d);
  }

  requestAnimationFrame(tick);
}

// ── Boot: draw once immediately, then enter loop ───────────────────────────
(function boot() {
  const d = Ephemeris.computeVenusPhase(new Date());
  drawVenusPhase(d.phaseAngleDeg, d.isEastern);
  drawGeometry(d);
})();

tick();
