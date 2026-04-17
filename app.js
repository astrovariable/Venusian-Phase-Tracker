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
// Core algorithm (Meeus §41):
//   phaseAngle i: 0° = full (Earth behind Venus from Sun), 180° = new (Venus between)
//   Terminator semi-minor axis: b = R * cos(i)
//     i < 90°  → b > 0 (gibbous: more than half lit)
//     i = 90°  → b = 0 (quarter: exactly half lit)
//     i > 90°  → b < 0 (crescent: less than half lit)
//
//   The terminator ellipse has semi-major R (vertical) and semi-minor |b| (horizontal).
//   It is centred at the disk centre.
//   The lit outer limb is the semicircle on the `litSide` (+x if eastern, -x if western).
//
//   Closed path for the lit region:
//     Gibbous (b ≥ 0):
//       Start top of disk → arc down the lit semicircle (outer limb)
//       → ellipse back up on the SAME side (terminator curves away from lit limb)
//     Crescent (b < 0):
//       Start top of disk → arc down the lit semicircle
//       → ellipse back up on the OPPOSITE side (terminator curves into lit side)
//
function drawVenusPhase(phaseAngleDeg, isEastern) {
  const { ctx, W, H } = vCanvas;
  const cx = W / 2, cy = H / 2;
  const R  = W * 0.42;

  ctx.clearRect(0, 0, W, H);

  // ── 1. Dark sphere background ─────────────────────────────────────────
  const darkGrad = ctx.createRadialGradient(cx - R*0.15, cy - R*0.15, R*0.05, cx, cy, R);
  darkGrad.addColorStop(0,   '#1a1830');
  darkGrad.addColorStop(0.6, '#0d0c1a');
  darkGrad.addColorStop(1,   '#060510');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TWO_PI);
  ctx.fillStyle = darkGrad;
  ctx.fill();

  const i   = phaseAngleDeg * Math.PI / 180;
  const b   = R * Math.cos(i);        // terminator semi-minor (signed)
  const ab  = Math.abs(b);

  // litSign: +1 if eastern (right side lit), -1 if western (left side lit)
  const s   = isEastern ? 1 : -1;

  // ── 2. Build the lit-region path ──────────────────────────────────────
  // We work in a coordinate system where the lit limb is always on the RIGHT (+x).
  // Then we apply a horizontal flip if western (s = -1) via a transform.
  ctx.save();
  // Flip horizontally around centre if western elongation
  ctx.translate(cx, cy);
  ctx.scale(s, 1);
  ctx.translate(-cx, -cy);

  // Surface gradient: bright on the right (sub-solar), dark at left edge
  const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
  grad.addColorStop(0.00, '#0a0510');
  grad.addColorStop(0.35, '#6a3010');
  grad.addColorStop(0.60, '#d08030');
  grad.addColorStop(0.78, '#f0c060');
  grad.addColorStop(0.90, '#fff5c0');
  grad.addColorStop(1.00, '#ffffff');

  ctx.beginPath();

  if (phaseAngleDeg >= 179.5) {
    // New Venus – no lit area, nothing to draw
    ctx.restore();
    return;
  }

  if (phaseAngleDeg <= 0.5) {
    // Full Venus – entire disk lit
    ctx.arc(cx, cy, R, 0, TWO_PI);
  } else if (b >= 0) {
    // ── Gibbous (0° < i < 90°): terminator curves toward dark side ──────
    // Path: top → down right semicircle → up terminator ellipse (left side of ellipse)
    //   Right semicircle: angles -π/2 → +π/2  (clockwise, standard canvas direction)
    //   Terminator ellipse left arc: angles +π/2 → -π/2  (going UP, i.e. anticlockwise)
    //     but the ellipse semi-minor is `b` on the x-axis.
    //     For gibbous, terminator is on the DARK side → its arc closes on the left.
    //     We draw the ellipse on the left: from bottom (+π/2 in ellipse) to top (-π/2).

    // Right (lit) semicircle – clockwise top to bottom
    ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false);

    // Terminator ellipse – anticlockwise bottom to top, x scaled by b/R
    // ellipse(x, y, rx, ry, rotation, startAngle, endAngle, anticlockwise)
    ctx.ellipse(cx, cy, ab, R, 0, Math.PI / 2, -Math.PI / 2, true);

  } else {
    // ── Crescent (90° < i < 180°): terminator curves toward lit side ─────
    // Now |b| is the semi-minor, and it pokes into the lit side.
    // Path: top → down right semicircle → terminator ellipse curves back on RIGHT side

    // Right (lit) semicircle – clockwise top to bottom
    ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false);

    // Terminator ellipse on the RIGHT side – clockwise bottom to top
    // (the crescent terminator ellipse arcs on the same side as the lit limb)
    ctx.ellipse(cx, cy, ab, R, 0, Math.PI / 2, -Math.PI / 2, false);
  }

  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();

  // ── 3. Atmospheric limb glow ──────────────────────────────────────────
  const limb = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.06);
  limb.addColorStop(0,    'transparent');
  limb.addColorStop(0.65, 'rgba(210,140,40,0.06)');
  limb.addColorStop(1,    'rgba(255,180,60,0.28)');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.06, 0, TWO_PI);
  ctx.fillStyle = limb;
  ctx.fill();

  // ── 4. Disk edge ring ─────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(220,180,100,0.22)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ── 5. Illumination % label on disk ──────────────────────────────────
  // (driven from tick() via canvas text)
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
