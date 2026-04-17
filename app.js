/**
 * app.js  –  Venus phase real-time renderer
 * Fixes:
 *  1. DPR scaling done once at load, not inside the draw loop
 *  2. Phase shape drawn correctly using offscreen canvas (no fighting clip+composite)
 *  3. Ephemeris called every second, renders every frame
 */
"use strict";

// ── Helpers ───────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(n, d) { return n.toFixed(d); }

// ── DPR-aware canvas setup (done ONCE) ────────────────────────────────────
function setupCanvas(id, cssW, cssH) {
  const canvas = document.getElementById(id);
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx, W: cssW, H: cssH, dpr };
}

const venus   = setupCanvas('venus-canvas',    260, 260);
const geo     = setupCanvas('geometry-canvas', 340, 340);

// ── Starfield ─────────────────────────────────────────────────────────────
(function() {
  const sfCanvas = document.getElementById('starfield');
  const sfCtx = sfCanvas.getContext('2d');
  let stars = [], W, H;

  function resize() {
    W = sfCanvas.width  = window.innerWidth;
    H = sfCanvas.height = window.innerHeight;
    stars = Array.from({length: 300}, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.08 ? Math.random()*1.6+0.7 : Math.random()*0.8+0.2,
      a: Math.random()*0.5+0.2,
      sp: Math.random()*0.0015+0.0004,
      ph: Math.random()*Math.PI*2,
      warm: Math.random() < 0.12
    }));
  }

  let t = 0;
  function draw() {
    sfCtx.clearRect(0,0,W,H);
    t++;
    for (const s of stars) {
      const twinkle = 0.6 + 0.4*Math.sin(t*s.sp*60 + s.ph);
      sfCtx.globalAlpha = s.a * twinkle;
      sfCtx.fillStyle = s.warm ? '#ffe8a0' : '#e8f0ff';
      sfCtx.beginPath();
      sfCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      sfCtx.fill();
    }
    sfCtx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ── Venus phase disk ──────────────────────────────────────────────────────
// Strategy: draw on an offscreen canvas at CSS pixel size,
// then composite lit/dark halves cleanly without nested save/restore fighting clip.

function drawVenusPhase(phaseAngleDeg, isEastern) {
  const { ctx, W, H } = venus;
  const cx = W/2, cy = H/2;
  const R  = W * 0.40;

  ctx.clearRect(0, 0, W, H);

  const pa  = phaseAngleDeg * Math.PI / 180;   // 0 = full, π = new
  // terminator ellipse semi-minor axis (can be negative = gibbous side)
  const termB = R * Math.cos(pa);              // positive=crescent, negative=gibbous

  // Lit limb direction: if eastern elongation, right side (+x) is lit
  const litSign = isEastern ? 1 : -1;

  // ── Build offscreen canvas for lit face ───────────────────────────────
  const oc = document.createElement('canvas');
  oc.width  = venus.canvas.width;
  oc.height = venus.canvas.height;
  const oc2 = oc.getContext('2d');
  const dpr = venus.dpr;
  // Work in CSS-pixel coordinates on offscreen canvas too
  oc2.scale(dpr, dpr);

  // Surface gradient (brightest at sub-solar point, darkening to limb)
  const gx = cx + litSign * R * 0.3;
  const grad = oc2.createRadialGradient(gx, cy - R*0.18, R*0.04, cx, cy, R);
  grad.addColorStop(0.00, '#fffde0');
  grad.addColorStop(0.25, '#f5d878');
  grad.addColorStop(0.55, '#c98a3a');
  grad.addColorStop(0.82, '#7a4010');
  grad.addColorStop(1.00, '#2a1002');

  // Step 1: fill entire disk with gradient
  oc2.beginPath();
  oc2.arc(cx, cy, R, 0, Math.PI*2);
  oc2.fillStyle = grad;
  oc2.fill();

  // Step 2: erase the dark half using destination-out
  // The dark half is the semi-disk on the -litSign side
  oc2.globalCompositeOperation = 'destination-out';
  oc2.beginPath();
  if (phaseAngleDeg <= 90) {
    // Crescent: erase full dark half THEN restore the lit elliptical sliver
    // Erase the dark semicircle
    const darkAngleStart = litSign > 0 ? Math.PI/2 : -Math.PI/2;
    const darkAngleEnd   = litSign > 0 ? 3*Math.PI/2 : Math.PI/2;
    oc2.arc(cx, cy, R, darkAngleStart, darkAngleEnd, false);
    oc2.closePath();
    oc2.fill();

    // Also erase the part of the lit half that's past the terminator
    // (the terminator ellipse on the lit side)
    oc2.beginPath();
    const ex = Math.abs(termB);   // semi-minor of terminator ellipse
    // This ellipse sits at x=cx, covers the portion we must erase on lit side
    // arc from top to bottom on the lit side
    const a1 = litSign > 0 ? -Math.PI/2 : Math.PI/2;
    const a2 = litSign > 0 ?  Math.PI/2 : 3*Math.PI/2;
    oc2.ellipse(cx, cy, ex, R, 0, a1, a2, litSign < 0);
    oc2.closePath();
    oc2.fill();

  } else {
    // Gibbous: only erase the dark crescent sliver
    // Erase the dark semicircle on -litSign side
    const darkAngleStart = litSign > 0 ? Math.PI/2 : -Math.PI/2;
    const darkAngleEnd   = litSign > 0 ? 3*Math.PI/2 : Math.PI/2;
    oc2.arc(cx, cy, R, darkAngleStart, darkAngleEnd, false);
    oc2.closePath();
    oc2.fill();

    // Re-add back the lit part of the dark-side ellipse (termB is negative = extends dark side)
    oc2.globalCompositeOperation = 'source-over';
    oc2.fillStyle = grad;
    oc2.beginPath();
    const ex = Math.abs(termB);
    const a1 = litSign > 0 ? Math.PI/2 : -Math.PI/2;
    const a2 = litSign > 0 ? 3*Math.PI/2 : Math.PI/2;
    oc2.ellipse(cx, cy, ex, R, 0, a1, a2, litSign > 0);
    oc2.closePath();
    oc2.fill();
  }

  // ── Composite onto main canvas ─────────────────────────────────────────
  // First draw dark sphere
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.fillStyle = '#060818';
  ctx.fill();
  ctx.restore();

  // Then paste lit face
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.clip();
  ctx.drawImage(oc, 0, 0);
  ctx.restore();

  // Atmospheric limb haze
  ctx.save();
  const haze = ctx.createRadialGradient(cx, cy, R*0.80, cx, cy, R*1.04);
  haze.addColorStop(0,   'transparent');
  haze.addColorStop(0.7, 'rgba(200,150,50,0.04)');
  haze.addColorStop(1,   'rgba(220,160,40,0.22)');
  ctx.beginPath();
  ctx.arc(cx, cy, R*1.04, 0, Math.PI*2);
  ctx.fillStyle = haze;
  ctx.fill();
  ctx.restore();

  // Thin limb ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(200,170,100,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// ── Geometry diagram ──────────────────────────────────────────────────────
function drawGeometry(data) {
  const { ctx, W, H } = geo;
  ctx.clearRect(0, 0, W, H);

  const cx = W/2, cy = H/2;
  const scale = W * 0.40 / 1.1;  // AU → px

  const eOrb = 1.000 * scale;
  const vOrb = 0.723 * scale;

  // Orbit dashes
  function orbit(r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  orbit(eOrb, 'rgba(150,190,230,0.18)');
  orbit(vOrb, 'rgba(230,200,110,0.18)');

  const eRad = data.earthEclLon * Math.PI/180;
  const vRad = data.venusEclLon * Math.PI/180;

  const Ex = cx + eOrb * Math.cos(eRad);
  const Ey = cy - eOrb * Math.sin(eRad);
  const Vx = cx + vOrb * Math.cos(vRad);
  const Vy = cy - vOrb * Math.sin(vRad);

  // Sun
  const sunG = ctx.createRadialGradient(cx,cy,0, cx,cy,18);
  sunG.addColorStop(0,   '#fffbe0');
  sunG.addColorStop(0.4, '#f8c840');
  sunG.addColorStop(1,   'transparent');
  ctx.beginPath(); ctx.arc(cx,cy,18,0,Math.PI*2);
  ctx.fillStyle = sunG; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2);
  ctx.fillStyle = '#f8c840'; ctx.fill();

  // Geometry lines
  ctx.save();
  ctx.strokeStyle = 'rgba(240,200,60,0.28)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(Vx,Vy); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,200,255,0.28)';
  ctx.beginPath(); ctx.moveTo(Ex,Ey); ctx.lineTo(Vx,Vy); ctx.stroke();
  ctx.restore();

  // Earth
  const eG = ctx.createRadialGradient(Ex-2,Ey-2,0, Ex,Ey,7);
  eG.addColorStop(0,'#d8f0ff'); eG.addColorStop(1,'#3478b0');
  ctx.save();
  ctx.shadowColor = 'rgba(80,160,255,0.5)'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(Ex,Ey,6,0,Math.PI*2);
  ctx.fillStyle = eG; ctx.fill();
  ctx.restore();

  // Venus
  const vG = ctx.createRadialGradient(Vx-2,Vy-2,0, Vx,Vy,6);
  vG.addColorStop(0,'#fff8d8'); vG.addColorStop(0.5,'#e8c870'); vG.addColorStop(1,'#b07010');
  ctx.save();
  ctx.shadowColor = 'rgba(230,200,100,0.6)'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(Vx,Vy,5,0,Math.PI*2);
  ctx.fillStyle = vG; ctx.fill();
  ctx.restore();

  // Labels
  ctx.font = '10px Inconsolata, monospace';
  ctx.fillStyle = 'rgba(150,195,235,0.75)';
  ctx.fillText('⊕', Ex+8, Ey-6);
  ctx.fillStyle = 'rgba(230,200,100,0.85)';
  ctx.fillText('♀', Vx+8, Vy-6);
  ctx.fillStyle = 'rgba(248,200,64,0.85)';
  ctx.fillText('☀', cx+9, cy-6);

  // Orbit name labels
  ctx.font = '9px Inconsolata, monospace';
  ctx.fillStyle = 'rgba(150,195,235,0.35)';
  ctx.fillText('EARTH', cx + eOrb*0.68, cy - eOrb*0.68);
  ctx.fillStyle = 'rgba(230,200,100,0.35)';
  ctx.fillText('VENUS', cx + vOrb*0.65, cy - vOrb*0.65);

  // Phase angle arc at Venus
  if (data.elongation > 4) {
    const toSun   = Math.atan2(cy - Vy, cx - Vx);
    const toEarth = Math.atan2(Ey - Vy, Ex - Vx);
    ctx.save();
    ctx.strokeStyle = 'rgba(220,160,60,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(Vx, Vy, 18, toSun, toEarth, false);
    ctx.stroke();
    ctx.restore();
  }
}

// ── DOM refs ──────────────────────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────────────────
let lastData = null;
let lastSec  = -1;

function tick() {
  const now = new Date();

  // UTC clock (every frame is fine)
  elClock.textContent =
    pad(now.getUTCHours()) + ':' +
    pad(now.getUTCMinutes()) + ':' +
    pad(now.getUTCSeconds()) + ' UTC';

  // Ephemeris: recalculate every second
  const sec = Math.floor(now / 1000);
  if (sec !== lastSec) {
    lastSec  = sec;
    const d  = Ephemeris.computeVenusPhase(now);
    lastData = d;

    // Update data cards
    elIllum.textContent   = fmt(d.illumination,  1);
    elPhase.textContent   = d.phaseName;
    elElong.textContent   = fmt(d.elongation,    2);
    elDist.textContent    = fmt(d.distanceAU,    4);
    elAngle.textContent   = fmt(d.phaseAngleDeg, 2);
    elAngular.textContent = fmt(d.angularSize,   1);
    elJD.textContent      = fmt(d.jd,            4);

    // Timeline: 0% = new (180°), 100% = full (0°)
    const pct = (1 - d.phaseAngleDeg / 180) * 100;
    tlFill.style.width = pct + '%';
    tlThumb.style.left = pct + '%';

    // Phase disk & geometry
    drawVenusPhase(d.phaseAngleDeg, d.isEastern);
    drawGeometry(d);
  }

  requestAnimationFrame(tick);
}

// ── Boot ──────────────────────────────────────────────────────────────────
// Draw immediately, then start the loop
const boot = Ephemeris.computeVenusPhase(new Date());
lastData = boot;
drawVenusPhase(boot.phaseAngleDeg, boot.isEastern);
drawGeometry(boot);
tick();
