/**
 * app.js
 * Real-time Venus phase visualiser
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

// ── Starfield ──────────────────────────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let W, H;

  const STAR_COUNT = 280;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = Math.random();
      stars.push({
        x:    Math.random() * W,
        y:    Math.random() * H,
        size: r < 0.1 ? Math.random() * 1.8 + 0.8
              : r < 0.4 ? Math.random() * 1.0 + 0.3
              : Math.random() * 0.5 + 0.1,
        alpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.002 + 0.0005,
        twinkleOffset: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 210 : 30) : 0
      });
    }
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.016;
    for (const s of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * 60 + s.twinkleOffset);
      const alpha = s.alpha * (0.6 + 0.4 * twinkle);
      if (s.hue === 210) {
        ctx.fillStyle = `rgba(168,196,224,${alpha})`;
      } else if (s.hue === 30) {
        ctx.fillStyle = `rgba(255,220,160,${alpha})`;
      } else {
        ctx.fillStyle = `rgba(240,232,215,${alpha})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ── Venus phase canvas renderer ────────────────────────────────────────────
function drawVenusPhase(canvas, illumination, phaseAngleDeg, isEast) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = W * 0.38;

  ctx.clearRect(0, 0, W, H);

  const k = illumination / 100;           // 0..1
  const phaseAngleRad = phaseAngleDeg * Math.PI / 180;

  // Draw full dark sphere first
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.fillStyle = '#0d0f1e';
  ctx.fill();
  ctx.restore();

  // Lit portion using Meeus limb/terminator model
  // The lit crescent is drawn as:
  //  - A semicircle on the lit side
  //  - An ellipse for the terminator with semi-minor axis b = R·cos(phaseAngle)

  // Phase angle: 0=full, 90=quarter, 180=new
  // The lit side: right if east, left if west
  const litRight = isEast;

  ctx.save();

  // Clip to disk
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.clip();

  // Draw lit hemisphere
  const gradient = ctx.createRadialGradient(
    cx + (litRight ? -R * 0.25 : R * 0.25),
    cy - R * 0.2,
    R * 0.05,
    cx, cy, R
  );
  gradient.addColorStop(0,   '#fff8e1');
  gradient.addColorStop(0.3, '#f5d67a');
  gradient.addColorStop(0.65,'#c8974a');
  gradient.addColorStop(0.9, '#8a5a1f');
  gradient.addColorStop(1,   '#3d2505');

  // Terminator x-axis position: R * cos(phaseAngle), but note:
  // x coord of terminator center: goes from +R (new) to 0 (quarter) to -R (full)
  // from the lit-side perspective. Flip if west.
  const terminatorX = R * Math.cos(phaseAngleRad);

  // Build the lit face path
  ctx.beginPath();

  if (litRight) {
    // Lit half is the RIGHT semicircle, terminator on left side within disk
    // Semi-minor axis of terminator ellipse = R·cos(phaseAngle)
    // if phaseAngle < 90: terminator is on the left (concave right) → crescent opening right
    // if phaseAngle > 90: terminator is on the right (convex right) → gibbous opening left
    if (phaseAngleDeg <= 90) {
      // Crescent: right semicircle minus left ellipse
      // Draw right semicircle
      ctx.arc(cx, cy, R, -Math.PI/2, Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Carve out the dark terminator ellipse
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(terminatorX), R, 0, -Math.PI/2, Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

    } else {
      // Gibbous: full circle lit, but left part dark
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Dark left side (terminator opens to the right side now)
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      // Draw left semicircle
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI/2, 3*Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      // Restore the lit elliptical piece
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(terminatorX), R, 0, Math.PI/2, 3*Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Lit half is LEFT
    if (phaseAngleDeg <= 90) {
      ctx.arc(cx, cy, R, Math.PI/2, 3*Math.PI/2, false);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(terminatorX), R, 0, Math.PI/2, 3*Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

    } else {
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI/2, Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(terminatorX), R, 0, -Math.PI/2, Math.PI/2, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();

  // Atmospheric limb glow
  ctx.save();
  const limbGrad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R);
  limbGrad.addColorStop(0, 'transparent');
  limbGrad.addColorStop(0.7, 'rgba(210,160,60,0.05)');
  limbGrad.addColorStop(1, 'rgba(200,130,30,0.18)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = limbGrad;
  ctx.lineWidth = R * 0.08;
  ctx.stroke();
  ctx.restore();

  // Disk border
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(212,190,140,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ── Geometry diagram ───────────────────────────────────────────────────────
function drawGeometry(canvas, data) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const scale = W * 0.38; // max radius for 1.1 AU

  // Orbital radii (AU) – scaled
  const earthOrbitR = (1.0 / 1.15) * scale;
  const venusOrbitR = (0.723 / 1.15) * scale;

  // Draw orbit rings
  function drawOrbit(r, color) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2*Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawOrbit(earthOrbitR, 'rgba(168,196,224,0.2)');
  drawOrbit(venusOrbitR, 'rgba(232,201,122,0.2)');

  // Planet positions
  const earthLonRad = data.earthEclLon * Math.PI / 180;
  const venusLonRad = data.venusEclLon * Math.PI / 180;

  const Ex = cx + earthOrbitR * Math.cos(earthLonRad);
  const Ey = cy - earthOrbitR * Math.sin(earthLonRad);
  const Vx = cx + venusOrbitR * Math.cos(venusLonRad);
  const Vy = cy - venusOrbitR * Math.sin(venusLonRad);

  // Sun glow
  const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
  sunGrad.addColorStop(0, '#fff8c0');
  sunGrad.addColorStop(0.4, '#f5c842');
  sunGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, 2*Math.PI);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Sun dot
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, 2*Math.PI);
  ctx.fillStyle = '#f5c842';
  ctx.fill();

  // Sun–Venus–Earth angle lines (phase geometry)
  ctx.beginPath();
  ctx.moveTo(Vx, Vy);
  ctx.lineTo(cx, cy);
  ctx.strokeStyle = 'rgba(245,200,66,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(Vx, Vy);
  ctx.lineTo(Ex, Ey);
  ctx.strokeStyle = 'rgba(168,196,224,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Earth orbit label
  ctx.font = '500 9px Inconsolata, monospace';
  ctx.fillStyle = 'rgba(168,196,224,0.4)';
  ctx.fillText('EARTH', cx + earthOrbitR * 0.65, cy - earthOrbitR * 0.65);

  ctx.fillStyle = 'rgba(232,201,122,0.4)';
  ctx.fillText('VENUS', cx + venusOrbitR * 0.65, cy - venusOrbitR * 0.65);

  // Earth dot
  ctx.save();
  const earthGrad = ctx.createRadialGradient(Ex, Ey, 0, Ex, Ey, 8);
  earthGrad.addColorStop(0, '#d0e8ff');
  earthGrad.addColorStop(1, '#4488cc');
  ctx.beginPath();
  ctx.arc(Ex, Ey, 7, 0, 2*Math.PI);
  ctx.fillStyle = earthGrad;
  ctx.shadowColor = 'rgba(100,180,255,0.6)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  // Venus dot
  ctx.save();
  const venusGrad = ctx.createRadialGradient(Vx - 2, Vy - 2, 0, Vx, Vy, 8);
  venusGrad.addColorStop(0, '#fff8e0');
  venusGrad.addColorStop(0.5, '#e8c97a');
  venusGrad.addColorStop(1, '#c8841a');
  ctx.beginPath();
  ctx.arc(Vx, Vy, 6, 0, 2*Math.PI);
  ctx.fillStyle = venusGrad;
  ctx.shadowColor = 'rgba(232,200,120,0.7)';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();

  // Labels
  ctx.font = '500 10px Inconsolata, monospace';
  ctx.fillStyle = 'rgba(168,196,224,0.8)';
  ctx.fillText('⊕', Ex + 10, Ey - 6);
  ctx.fillStyle = 'rgba(232,201,122,0.9)';
  ctx.fillText('♀', Vx + 9, Vy - 5);
  ctx.fillStyle = 'rgba(245,200,66,0.9)';
  ctx.fillText('☀', cx + 10, cy - 6);

  // Phase angle arc at Venus position
  if (data.elongation > 5) {
    const arcR = 20;
    const toSun   = Math.atan2(cy - Vy, cx - Vx);
    const toEarth = Math.atan2(Ey - Vy, Ex - Vx);
    ctx.beginPath();
    ctx.arc(Vx, Vy, arcR, toSun, toEarth, false);
    ctx.strokeStyle = 'rgba(200,150,80,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ── UI Update ──────────────────────────────────────────────────────────────
const venusCanvas    = document.getElementById('venus-canvas');
const geometryCanvas = document.getElementById('geometry-canvas');
const sunIndicator   = document.getElementById('sun-indicator');

const elIllum    = document.getElementById('val-illumination');
const elPhase    = document.getElementById('val-phase-name');
const elElong    = document.getElementById('val-elongation');
const elDist     = document.getElementById('val-distance');
const elAngle    = document.getElementById('val-angle');
const elAngular  = document.getElementById('val-angular');
const elClock    = document.getElementById('utc-clock');
const elJD       = document.getElementById('jd-display');
const tlFill     = document.getElementById('timeline-fill');
const tlThumb    = document.getElementById('timeline-thumb');

function pad(n, d=2) { return String(n).padStart(d,'0'); }

function formatNum(n, decimals) {
  return n.toFixed(decimals);
}

let lastData = null;
let frameCount = 0;

function update() {
  const now = new Date();

  // Clock
  const h = pad(now.getUTCHours());
  const m = pad(now.getUTCMinutes());
  const s = pad(now.getUTCSeconds());
  elClock.textContent = `${h}:${m}:${s} UTC`;

  // Compute ephemeris every second (not every frame)
  const data = Ephemeris.computeVenusPhase(now);
  lastData = data;

  // Values
  elIllum.textContent  = formatNum(data.illumination, 1);
  elPhase.textContent  = data.phaseName;
  elElong.textContent  = formatNum(data.elongation, 2);
  elDist.textContent   = formatNum(data.distanceAU, 4);
  elAngle.textContent  = formatNum(data.phaseAngle, 2);
  elAngular.textContent= formatNum(data.angularSize, 1);
  elJD.textContent     = formatNum(data.jd, 5);

  // Timeline (0=new at 180°, 1=full at 0°)
  const pct = (1 - data.phaseAngle / 180) * 100;
  tlFill.style.width       = pct + '%';
  tlThumb.style.left       = pct + '%';

  // Sun indicator rotation (pointing toward Sun from Venus perspective)
  // Rotate so the ☀ points toward where the Sun is relative to the viewer
  const sunAngle = data.lonDiffDeg > 0 ? -90 : 90; // simplistic: E or W
  sunIndicator.style.transform = `rotate(${data.isEast ? -50 : 130}deg)`;

  // Draw Venus phase
  drawVenusPhase(venusCanvas, data.illumination, data.phaseAngle, data.isEast);

  // Draw geometry (every 5 frames for perf)
  if (frameCount % 5 === 0) {
    drawGeometry(geometryCanvas, data);
  }
  frameCount++;
}

// ── Color the illumination value by phase ─────────────────────────────────
function updatePhaseColor(illumination) {
  const card = document.getElementById('card-phase');
  const hue  = illumination < 20 ? 220
              : illumination < 50 ? 200
              : illumination < 80 ? 40
              : 48;
  card.style.borderTop = `2px solid hsl(${hue}, 60%, 60%)`;
}

// ── Main loop ──────────────────────────────────────────────────────────────
let lastSecond = -1;

function loop() {
  const sec = Math.floor(Date.now() / 1000);
  if (sec !== lastSecond) {
    update();
    if (lastData) updatePhaseColor(lastData.illumination);
    lastSecond = sec;
  }
  requestAnimationFrame(loop);
}

// Scale geometry canvas for device pixel ratio
(function scaleCanvas() {
  const dpr = window.devicePixelRatio || 1;
  [venusCanvas, geometryCanvas].forEach(c => {
    const w = c.width, h = c.height;
    c.width  = w * dpr;
    c.height = h * dpr;
    c.style.width  = w + 'px';
    c.style.height = h + 'px';
    c.getContext('2d').scale(dpr, dpr);
  });
})();

// Immediate draw, then loop
update();
loop();
