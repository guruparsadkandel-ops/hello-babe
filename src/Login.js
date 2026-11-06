import { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ── 3D Floating Background ───────────────────────────────────────
function Background3D() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    // 3D floating heart particles
    const hearts = Array.from({ length: 32 }, (_, i) => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      z:     Math.random() * 400 + 50,      // depth
      vx:    (Math.random() - 0.5) * 0.4,
      vy:    -0.3 - Math.random() * 0.5,    // float up
      vz:    (Math.random() - 0.5) * 0.8,   // z drift
      size:  8 + Math.random() * 18,
      emoji: ['💗','💕','🌸','✨','💖','🌺','💝','⭐'][i % 8],
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.02,
    }));

    // 3D orbiting rings
    const rings = [
      { cx: W*0.15, cy: H*0.2,  rx:55, ry:18, angle:0, speed:0.008, color:'rgba(255,150,170,0.18)', tilt:0.4 },
      { cx: W*0.85, cy: H*0.35, rx:70, ry:22, angle:1, speed:0.006, color:'rgba(220,120,150,0.15)', tilt:0.6 },
      { cx: W*0.5,  cy: H*0.08, rx:90, ry:28, angle:2, speed:0.004, color:'rgba(255,180,200,0.12)', tilt:0.3 },
      { cx: W*0.1,  cy: H*0.7,  rx:50, ry:16, angle:3, speed:0.01,  color:'rgba(200,100,140,0.14)', tilt:0.5 },
      { cx: W*0.88, cy: H*0.78, rx:65, ry:20, angle:4, speed:0.007, color:'rgba(240,160,180,0.13)', tilt:0.45 },
    ];

    // 3D floating spheres/orbs
    const orbs = Array.from({ length: 7 }, (_, i) => ({
      x:    W * (0.1 + i * 0.13),
      y:    H * (0.1 + (i % 3) * 0.35),
      z:    100 + Math.random() * 300,
      r:    20 + Math.random() * 40,
      phase: (i / 7) * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.008,
      hue:  [340, 320, 350, 330, 345, 315, 355][i],
    }));

    // Bokeh dots (out-of-focus light)
    const bokeh = Array.from({ length: 20 }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    4 + Math.random() * 22,
      alpha: 0.04 + Math.random() * 0.09,
      phase: Math.random() * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.01,
    }));

    let t = 0;

    function project(x, y, z) {
      const fov = 400;
      const scale = fov / (fov + z);
      return {
        sx: W/2 + (x - W/2) * scale,
        sy: H/2 + (y - H/2) * scale,
        scale,
      };
    }

    function drawOrb(orb, t) {
      const bobX = orb.x + Math.sin(t * orb.speed * 0.7 + orb.phase) * 25;
      const bobY = orb.y + Math.cos(t * orb.speed + orb.phase) * 20;
      const zPulse = orb.z + Math.sin(t * orb.speed * 1.3) * 60;
      const { sx, sy, scale } = project(bobX, bobY, zPulse);
      const r = orb.r * scale;

      // 3D sphere gradient
      const grad = ctx.createRadialGradient(sx - r*0.3, sy - r*0.3, r*0.1, sx, sy, r);
      grad.addColorStop(0,   `hsla(${orb.hue}, 90%, 92%, ${0.55 * scale})`);
      grad.addColorStop(0.4, `hsla(${orb.hue}, 80%, 82%, ${0.35 * scale})`);
      grad.addColorStop(0.8, `hsla(${orb.hue}, 70%, 70%, ${0.2  * scale})`);
      grad.addColorStop(1,   `hsla(${orb.hue}, 60%, 60%, 0)`);

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Specular highlight
      const hGrad = ctx.createRadialGradient(sx - r*0.35, sy - r*0.35, 0, sx - r*0.2, sy - r*0.2, r*0.45);
      hGrad.addColorStop(0, `rgba(255,255,255,${0.5 * scale})`);
      hGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = hGrad;
      ctx.fill();
    }

    function drawRing(ring, t) {
      ring.angle += ring.speed;
      const bob = Math.sin(t * 0.008 + ring.angle) * 12;
      ctx.save();
      ctx.translate(ring.cx, ring.cy + bob);

      // Draw ellipse as ring (3D perspective)
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.rx, ring.ry, ring.tilt, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Second inner ring for depth
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.rx * 0.7, ring.ry * 0.7, ring.tilt + 0.2, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color.replace('0.', '0.0');
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    function drawBokeh(b, t) {
      const pulse = 0.7 + 0.3 * Math.sin(t * b.speed + b.phase);
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * pulse);
      grad.addColorStop(0,   `rgba(255,160,180,${b.alpha})`);
      grad.addColorStop(0.5, `rgba(255,200,215,${b.alpha * 0.5})`);
      grad.addColorStop(1,   'rgba(255,220,230,0)');
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    function drawHeart(h, t) {
      h.phase += h.speed;
      h.x += h.vx + Math.sin(h.phase * 0.7) * 0.3;
      h.y += h.vy;
      h.z += h.vz;

      // Wrap around
      if (h.y < -30) { h.y = H + 20; h.x = Math.random() * W; }
      if (h.x < -30) h.x = W + 20;
      if (h.x > W+30) h.x = -20;
      if (h.z < 50) h.z = 450;
      if (h.z > 450) h.z = 50;

      const { sx, sy, scale } = project(h.x, h.y, h.z);
      const size = h.size * scale;
      const alpha = 0.15 + 0.6 * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Slight 3D wobble rotation
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(h.phase) * 0.25);
      ctx.fillText(h.emoji, 0, 0);
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Base gradient
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0,   '#FFF5F7');
      bg.addColorStop(0.4, '#FFF0F5');
      bg.addColorStop(0.7, '#FDF5FF');
      bg.addColorStop(1,   '#FFF8F2');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Bokeh layer
      bokeh.forEach(b => drawBokeh(b, t));

      // 3D orbs (back layer — larger z)
      [...orbs].sort((a, b) => b.z - a.z).forEach(o => drawOrb(o, t));

      // Rings
      rings.forEach(r => drawRing(r, t));

      // 3D hearts (front layer)
      [...hearts].sort((a, b) => b.z - a.z).forEach(h => drawHeart(h, t));

      t++;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:0, pointerEvents:'none' }}
    />
  );
}

// ── Classic Nepal Flag ───────────────────────────────────────────
function SmallWavingFlag() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const timeRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // Nepal flag real proportions
    // Top triangle: wider at top, hypotenuse goes bottom-right to top-right
    // Bottom triangle: wider at top, sits below
    const POLE_X   = 12;
    const POLE_TOP = 8;
    const POLE_H   = H - 14;
    const FLAG_X   = POLE_X + 2;  // flag starts at pole
    const TOP_W    = 62;           // width of top triangle base
    const TOP_H    = 52;           // height of top triangle
    const BOT_W    = 48;           // width of bottom triangle base
    const BOT_H    = 36;           // height of bottom triangle
    const FLAG_Y   = POLE_TOP + 4;
    const SEGS     = 28;

    // Realistic cloth wave — 3 layers
    function wave(x, t, maxW) {
      const p = x / maxW;
      const w1 = Math.sin(p * 2.6 - t * 1.1) * 5.5 * p;
      const w2 = Math.sin(p * 5.0 - t * 2.0) * 1.8 * p;
      const w3 = Math.sin(p * 1.2 - t * 0.6) * 2.5 * p;
      return (w1 + w2 + w3) * (1 - 0.1 * p);
    }

    // Get warped point
    function wp(flagX, flagY, maxW) {
      const dy = wave(flagX, timeRef.current, maxW);
      return { x: FLAG_X + flagX, y: flagY + dy };
    }

    // Draw a warped triangle (Nepal flag shape)
    // Nepal top triangle: vertical left edge, horizontal top, hypotenuse bottom-right
    function drawTopTriangle(fillColor, borderColor, inset) {
      const y0 = FLAG_Y + inset;
      const h  = TOP_H - inset * 1.5;
      const w  = TOP_W - inset;

      ctx.beginPath();
      // Left edge (vertical at pole, not warped much)
      let p = wp(inset * 0.3, y0, TOP_W);
      ctx.moveTo(p.x, p.y);

      // Top edge (horizontal, waving)
      for (let i = 0; i <= SEGS; i++) {
        const x = inset * 0.3 + (i / SEGS) * w;
        p = wp(x, y0, TOP_W);
        ctx.lineTo(p.x, p.y);
      }

      // Hypotenuse: from top-right down to bottom-left
      // Nepal shape: top-right point connects to bottom of left edge
      for (let i = SEGS; i >= 0; i--) {
        const frac = i / SEGS;
        const x = inset * 0.3 + frac * w;
        const y = y0 + h * (1 - frac);
        p = wp(x, y, TOP_W);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    function drawBotTriangle(fillColor, borderColor, inset) {
      const y0 = FLAG_Y + TOP_H + inset * 0.5;
      const h  = BOT_H - inset;
      const w  = BOT_W - inset;

      ctx.beginPath();
      let p = wp(inset * 0.3, y0, BOT_W);
      ctx.moveTo(p.x, p.y);

      for (let i = 0; i <= SEGS; i++) {
        const x = inset * 0.3 + (i / SEGS) * w;
        p = wp(x, y0, BOT_W);
        ctx.lineTo(p.x, p.y);
      }

      for (let i = SEGS; i >= 0; i--) {
        const frac = i / SEGS;
        const x = inset * 0.3 + frac * w;
        const y = y0 + h * (1 - frac);
        p = wp(x, y, BOT_W);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    // Cloth shading strips
    function addShading(y0, h, maxW, inset) {
      for (let i = 0; i < SEGS; i++) {
        const x0 = inset + (i / SEGS) * (maxW - inset * 2);
        const x1 = inset + ((i + 1) / SEGS) * (maxW - inset * 2);
        const w0 = wave(x0, timeRef.current, maxW);
        const w1 = wave(x1, timeRef.current, maxW);
        const slope = (w1 - w0) / (maxW / SEGS);
        const light = Math.max(0, Math.min(0.3,  slope * 0.09));
        const dark  = Math.max(0, Math.min(0.3, -slope * 0.09));
        const frac0 = i / SEGS, frac1 = (i + 1) / SEGS;

        const p00 = wp(x0, y0 + inset, maxW);
        const p01 = wp(x0, y0 + inset + (h - inset * 1.5) * (1 - frac0), maxW);
        const p10 = wp(x1, y0 + inset, maxW);
        const p11 = wp(x1, y0 + inset + (h - inset * 1.5) * (1 - frac1), maxW);

        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        if (light > 0.01) { ctx.fillStyle = `rgba(255,200,200,${light})`; ctx.fill(); }
        if (dark  > 0.01) { ctx.fillStyle = `rgba(0,0,0,${dark})`;        ctx.fill(); }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // ── POLE ──
      const poleGrad = ctx.createLinearGradient(POLE_X - 3, 0, POLE_X + 3, 0);
      poleGrad.addColorStop(0,   '#5a3800');
      poleGrad.addColorStop(0.35,'#D4A853');
      poleGrad.addColorStop(0.6, '#F0C878');
      poleGrad.addColorStop(1,   '#5a3800');
      ctx.fillStyle = poleGrad;
      ctx.beginPath();
      ctx.roundRect(POLE_X - 2.5, POLE_TOP, 5, POLE_H, 2);
      ctx.fill();

      // Pole tip ball
      const ballGrad = ctx.createRadialGradient(POLE_X - 1, POLE_TOP, 0.5, POLE_X, POLE_TOP, 5);
      ballGrad.addColorStop(0, '#FFE680');
      ballGrad.addColorStop(1, '#8B6000');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(POLE_X, POLE_TOP, 5, 0, Math.PI * 2);
      ctx.fill();

      // ── TOP TRIANGLE — blue border ──
      drawTopTriangle('#003893', null, 0);
      // ── TOP TRIANGLE — red fill ──
      drawTopTriangle('#CC0000', null, 2.5);
      // ── Cloth shading on top ──
      addShading(FLAG_Y, TOP_H, TOP_W, 2.5);

      // ── BOTTOM TRIANGLE — blue border ──
      drawBotTriangle('#003893', null, 0);
      // ── BOTTOM TRIANGLE — red fill ──
      drawBotTriangle('#CC0000', null, 2.2);
      // ── Cloth shading on bottom ──
      addShading(FLAG_Y + TOP_H, BOT_H, BOT_W, 2.2);

      // ── MOON (top triangle) ──
      const moonX = FLAG_X + TOP_W * 0.38;
      const moonY = FLAG_Y + TOP_H * 0.3 + wave(TOP_W * 0.38, timeRef.current, TOP_W);
      // White circle
      ctx.fillStyle = 'rgba(255,255,240,0.96)';
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur  = 3;
      ctx.beginPath(); ctx.arc(moonX, moonY, 7, 0, Math.PI * 2); ctx.fill();
      // Red cutout to make crescent
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#CC0000';
      ctx.beginPath(); ctx.arc(moonX + 4.5, moonY - 1.5, 5.5, 0, Math.PI * 2); ctx.fill();

      // ── SUN (bottom triangle) ──
      const sunX = FLAG_X + BOT_W * 0.42;
      const sunY = FLAG_Y + TOP_H + BOT_H * 0.44 + wave(BOT_W * 0.42, timeRef.current, BOT_W);
      ctx.shadowColor = 'rgba(255,255,200,0.6)';
      ctx.shadowBlur  = 4;
      // Sun rays (12 pointed star)
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const inner = i % 2 === 0 ? 3.5 : 2.5;
        const outer = i % 2 === 0 ? 7.5 : 5.5;
        ctx.strokeStyle = 'rgba(255,255,230,0.96)';
        ctx.lineWidth   = i % 2 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(angle) * inner, sunY + Math.sin(angle) * inner);
        ctx.lineTo(sunX + Math.cos(angle) * outer, sunY + Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,230,0.96)';
      ctx.beginPath(); ctx.arc(sunX, sunY, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // ── Pole seam highlight ──
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const s0 = wp(1.5, FLAG_Y);
      ctx.moveTo(s0.x, s0.y);
      const s1 = wp(1.5, FLAG_Y + TOP_H + BOT_H);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }

    function animate() {
      timeRef.current += 0.028;
      draw();
      animRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} width={90} height={110} style={{ display:'block' }}/>;
}

// ── Ethereal Souls — transparent sketch, no background box ──────
function EtherealSouls() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const tRef      = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width  = 160;
    const H = canvas.height = 120;

    function draw() {
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);

      const pulse = 1 + Math.sin(t * 0.04) * 0.06;
      const sway  = Math.sin(t * 0.025) * 3;

      // ── MAN (left, standing, holding) ──
      const mx = 52, my = 62;
      ctx.save();

      // Body glow
      const mGlow = ctx.createRadialGradient(mx, my, 2, mx, my, 40);
      mGlow.addColorStop(0,   'rgba(180,200,255,0.22)');
      mGlow.addColorStop(1,   'rgba(180,200,255,0)');
      ctx.fillStyle = mGlow;
      ctx.beginPath(); ctx.ellipse(mx, my, 30, 50, 0, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.strokeStyle = 'rgba(200,215,255,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = 'rgba(180,200,255,0.8)';
      ctx.shadowBlur  = 8;
      ctx.beginPath(); ctx.ellipse(mx, my-44, 9, 11, 0.1, 0, Math.PI*2); ctx.stroke();

      // Neck + torso
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx, my-33); ctx.lineTo(mx, my-22); ctx.stroke();
      // Shoulders
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx-16, my-18);
      ctx.quadraticCurveTo(mx, my-24, mx+16, my-18);
      ctx.stroke();
      // Torso
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx-10, my-18); ctx.lineTo(mx-8, my+12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx+10, my-18); ctx.lineTo(mx+8, my+12); ctx.stroke();
      // Waist
      ctx.beginPath(); ctx.moveTo(mx-8, my+12); ctx.lineTo(mx+8, my+12); ctx.stroke();

      // Left arm down
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx-16, my-18);
      ctx.quadraticCurveTo(mx-20, my+5, mx-16, my+22);
      ctx.stroke();

      // Right arm — cradling, bent outward
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx+16, my-18);
      ctx.bezierCurveTo(mx+28, my-8, mx+34, my+8, mx+28, my+25);
      ctx.stroke();
      // Forearm horizontal under woman
      ctx.beginPath();
      ctx.moveTo(mx+28, my+25);
      ctx.quadraticCurveTo(mx+40, my+32, mx+55, my+28);
      ctx.stroke();

      // Legs
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx-5, my+12);
      ctx.quadraticCurveTo(mx-8, my+38, mx-7, my+55);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx+5, my+12);
      ctx.quadraticCurveTo(mx+8, my+38, mx+7, my+55);
      ctx.stroke();

      ctx.restore();

      // ── WOMAN (right, reclining/floating in arms) ──
      const wx = 108 + sway * 0.3, wy = 52;
      ctx.save();

      // Body glow — pink
      const wGlow = ctx.createRadialGradient(wx, wy, 2, wx, wy, 35);
      wGlow.addColorStop(0,   'rgba(255,160,190,0.22)');
      wGlow.addColorStop(1,   'rgba(255,160,190,0)');
      ctx.fillStyle = wGlow;
      ctx.beginPath(); ctx.ellipse(wx, wy, 28, 38, 0, 0, Math.PI*2); ctx.fill();

      // Head — tilted back slightly
      ctx.strokeStyle = 'rgba(255,180,200,0.9)';
      ctx.shadowColor = 'rgba(255,140,170,0.8)';
      ctx.shadowBlur  = 8;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.ellipse(wx-5, wy-32, 8, 10, -0.3, 0, Math.PI*2); ctx.stroke();

      // Flowing hair strands — the KEY detail
      for (let s = 0; s < 7; s++) {
        const sf    = s / 7;
        const sw    = Math.sin(t * 0.022 + sf * Math.PI * 1.5) * 8;
        const alpha = 0.7 - sf * 0.08;
        const width = 1.5 - sf * 0.15;
        ctx.strokeStyle = `rgba(255,160,185,${alpha})`;
        ctx.lineWidth   = width;
        ctx.shadowBlur  = 6 - s;
        ctx.beginPath();
        ctx.moveTo(wx - 5 + sf * 4, wy - 40);
        ctx.bezierCurveTo(
          wx + 15 + sw + sf*8,  wy - 55 + sf * 5,
          wx + 35 + sw + sf*10, wy - 58 + sf * 15,
          wx + 55 + sw + sf*12, wy - 52 + sf * 28
        );
        ctx.stroke();
      }

      // Neck
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,180,200,0.8)';
      ctx.shadowBlur  = 6;
      ctx.beginPath(); ctx.moveTo(wx-3, wy-22); ctx.lineTo(wx, wy-16); ctx.stroke();

      // Body — reclining curve
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx-12, wy-14);
      ctx.quadraticCurveTo(wx+5, wy-10, wx+18, wy-4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wx-12, wy-14);
      ctx.quadraticCurveTo(wx-15, wy+5, wx-8, wy+20);
      ctx.stroke();

      // Arm flowing out
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx-10, wy-10);
      ctx.bezierCurveTo(wx-18, wy+2, wx-20, wy+15, wx-15, wy+28);
      ctx.stroke();

      // Legs — gracefully draped
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(wx-8, wy+20);
      ctx.bezierCurveTo(wx+5, wy+30, wx+18, wy+32, wx+28, wy+28);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx-8, wy+20);
      ctx.bezierCurveTo(wx+2, wy+38, wx+12, wy+44, wx+22, wy+42);
      ctx.stroke();

      // Dress energy flow — soft trails downward
      for (let d = 0; d < 4; d++) {
        const df    = d / 4;
        const dw    = Math.sin(t * 0.02 + df * 2) * 5;
        const alpha = 0.35 - df * 0.06;
        ctx.strokeStyle = `rgba(240,140,170,${alpha})`;
        ctx.lineWidth   = 1.2 - df * 0.2;
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.moveTo(wx - 5 + df * 10, wy + 25);
        ctx.bezierCurveTo(wx + dw, wy + 45, wx + 8 + dw, wy + 62, wx - 5 + dw, wy + 75);
        ctx.stroke();
      }

      ctx.restore();

      // ── MERGE GLOW between them ──
      const gx = 85, gy = 85;
      ctx.save();
      const mg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 16 * pulse);
      mg.addColorStop(0,   `rgba(255,200,215,${0.45 * pulse})`);
      mg.addColorStop(0.5, `rgba(230,160,185,${0.2 * pulse})`);
      mg.addColorStop(1,   'rgba(200,120,155,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(gx, gy, 16 * pulse, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // ── FLOATING SPARKLES ──
      ctx.save();
      [[30,15],[75,8],[130,12],[148,35],[155,65],[140,90],[25,85],[48,100]].forEach(([sx,sy],i) => {
        const sp = Math.sin(t * 0.04 + i * 0.8) * 0.5 + 0.5;
        const sc = i % 2 === 0 ? `rgba(200,215,255,${sp * 0.7})` : `rgba(255,170,195,${sp * 0.7})`;
        ctx.fillStyle   = sc;
        ctx.shadowColor = sc;
        ctx.shadowBlur  = 4;
        const ss = 1.5 + sp;
        ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI*2); ctx.fill();
        // Cross sparkle
        ctx.strokeStyle = sc;
        ctx.lineWidth   = 0.7;
        ctx.beginPath(); ctx.moveTo(sx-ss*2,sy); ctx.lineTo(sx+ss*2,sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx,sy-ss*2); ctx.lineTo(sx,sy+ss*2); ctx.stroke();
      });
      ctx.restore();

      tRef.current++;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display:'block', marginBottom:6 }}
    />
  );
}


// ── Login ────────────────────────────────────────────────────────
function Login({ onLogin, onSignup }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState('');
  const [mounted, setMounted]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async () => {
    setError(''); setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const snap   = await getDoc(doc(db, 'users', result.user.uid));
      if (snap.exists()) { onLogin(snap.data()); }
      else { setError('Account not found. Please sign up first.'); }
    } catch { setError('Wrong email or password!'); }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const uid      = result.user.uid;
      const snap     = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        onLogin(snap.data());
      } else {
        const em   = result.user.email;
        const name = result.user.displayName || em.split('@')[0];
        await setDoc(doc(db, 'users', uid), {
          name, email: em.toLowerCase(), partnerEmail:'', coupleId:'',
          createdAt: new Date(), needsSetup: true,
        });
        setError('Welcome! Please use Sign Up to link with your partner.');
      }
    } catch { setError('Google sign-in failed. Please try again.'); }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email first, then tap Forgot Password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setForgotSent(true);
      setError('');
    } catch {
      setError('Could not send reset email. Check your email address.');
    }
  };

  const inputStyle = (name) => ({
    width:'100%', padding:'12px 20px',
    borderRadius:50,
    border: focused === name ? '1.5px solid #D4A0A0' : '1.5px solid rgba(220,180,180,0.4)',
    background: focused === name ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
    color:'#3D1515',
    fontSize:13,
    outline:'none',
    boxSizing:'border-box',
    fontFamily:"'Lato',sans-serif",
    transition:'all 0.3s ease',
    boxShadow: focused === name ? '0 4px 20px rgba(180,80,80,0.12)' : 'none',
    letterSpacing:'0.3px',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Lato:wght@300;400;700&display=swap');

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes heartbeat {
          0%,100% { transform: scale(1); }
          25%     { transform: scale(1.18); }
          50%     { transform: scale(1.06); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px) rotate(-2deg); }
          50%     { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes heartPulse {
          0%,100% { transform: scale(1); opacity: 0.9; }
          50%     { transform: scale(1.3); opacity: 1; }
        }
        .hb-login-btn:hover  { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(160,60,60,0.35) !important; }
        .hb-login-btn:active { transform: translateY(0px); }
        .hb-google-btn:hover { background: rgba(255,255,255,0.95) !important; transform: translateY(-1px); }
        .hb-signup-link:hover { letter-spacing: 2px; }
      `}</style>

      <div style={{
        height:'100vh', width:'100vw', overflow:'hidden',
        position:'relative', boxSizing:'border-box',
        background:'#FFF5F7',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'flex-start',
      }}>

        {/* 3D animated background */}
        <Background3D />

        {/* ── TOP SECTION ── */}
        <div style={{
          width:'100%', display:'flex', flexDirection:'column', alignItems:'center',
          paddingTop:28, paddingBottom:4, zIndex:2, position:'relative',
          opacity: mounted ? 1 : 0,
          animation: mounted ? 'fadeUp 0.9s ease both' : 'none',
        }}>
          {/* Ethereal souls illustration */}
          <EtherealSouls />

          {/* Brand name */}
          <div style={{ textAlign:'center' }}>
            <h1 style={{
              fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize:46, fontWeight:400,
              color:'#1A0505',
              margin:0, lineHeight:1,
              letterSpacing:3,
              fontStyle:'italic',
              textShadow:'0 2px 20px rgba(200,80,80,0.15)',
            }}>
              Hello Babe
            </h1>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              marginTop:5,
            }}>
              <div style={{ height:1, width:35, background:'linear-gradient(90deg, transparent, rgba(192,57,43,0.5))' }}/>
              <span style={{
                fontFamily:"'Lato',sans-serif",
                fontSize:8, letterSpacing:5,
                color:'rgba(140,40,40,0.8)',
                textTransform:'uppercase', fontWeight:400,
              }}>Your Private World</span>
              <div style={{ height:1, width:35, background:'linear-gradient(90deg, rgba(192,57,43,0.5), transparent)' }}/>
            </div>
          </div>

          {/* Tagline for women */}
          <p style={{
            fontFamily:"'Cormorant Garamond',Georgia,serif",
            fontSize:14, fontStyle:'italic', fontWeight:300,
            color:'rgba(100,30,30,0.6)',
            margin:'6px 0 0',
            letterSpacing:'0.5px',
          }}>
            For the love you deserve ♡
          </p>
        </div>

        {/* ── LOGIN CARD ── */}
        <div style={{
          width:'88%', maxWidth:360,
          background:'rgba(255,255,255,0.75)',
          backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          borderRadius:28,
          border:'1px solid rgba(255,200,200,0.4)',
          padding:'18px 22px 16px',
          boxShadow:'0 20px 60px rgba(180,60,60,0.1), 0 4px 16px rgba(0,0,0,0.05)',
          zIndex:2, position:'relative',
          boxSizing:'border-box',
          marginTop:6,
          opacity: mounted ? 1 : 0,
          animation: mounted ? 'fadeUp 0.9s 0.18s ease both' : 'none',
        }}>
          {/* Card header */}
          <div style={{ textAlign:'center', marginBottom:14 }}>
            <span style={{ fontSize:20, animation:'heartbeat 2.5s ease-in-out infinite', display:'inline-block' }}>❤️</span>
            <h2 style={{
              fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize:20, fontWeight:400,
              color:'#2D0A0A', margin:'4px 0 2px',
              letterSpacing:'1px',
            }}>Welcome Back</h2>
            <p style={{
              fontFamily:"'Lato',sans-serif",
              fontSize:11, color:'rgba(120,50,50,0.65)',
              margin:0, fontWeight:300, letterSpacing:'0.3px',
            }}>Sign in to your love story</p>
          </div>

          {error && (
            <div style={{
              background:'rgba(255,220,220,0.7)', border:'1px solid rgba(220,100,100,0.3)',
              borderRadius:12, padding:'9px 14px', marginBottom:14,
              fontSize:12, color:'#8B2020', fontFamily:"'Lato',sans-serif",
              textAlign:'center', backdropFilter:'blur(8px)',
            }}>{error}</div>
          )}

          {/* Email */}
          <div style={{ position:'relative', marginBottom:8 }}>
            <div style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:0.5, pointerEvents:'none' }}>✉️</div>
            <input
              type="email" placeholder="Your email" value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
              style={{ ...inputStyle('email'), paddingLeft:42 }}
            />
          </div>

          {/* Password */}
          <div style={{ position:'relative', marginBottom:4 }}>
            <div style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:0.5, pointerEvents:'none' }}>🔒</div>
            <input
              type={showPass ? 'text' : 'password'} placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused('')}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...inputStyle('password'), paddingLeft:42, paddingRight:44 }}
            />
            {/* Eye toggle */}
            <button
              onClick={() => setShowPass(v => !v)}
              style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:4, opacity:0.55, fontSize:16 }}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" stroke="#8B2020" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke="#8B2020" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="#8B2020" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#8B2020" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="3" stroke="#8B2020" strokeWidth="1.8"/>
                </svg>
              )}
            </button>
          </div>

          {/* Forgot password */}
          {forgotSent ? (
            <p style={{ textAlign:'right', fontSize:11, color:'#4CAF50', fontFamily:"'Lato',sans-serif", margin:'0 4px 10px', fontWeight:400 }}>
              ✓ Reset link sent to your email!
            </p>
          ) : (
            <p
              onClick={handleForgotPassword}
              style={{ textAlign:'right', fontSize:11, color:'rgba(160,60,60,0.65)', fontFamily:"'Lato',sans-serif", margin:'0 4px 10px', cursor:'pointer', fontWeight:300, fontStyle:'italic' }}
            >
              Forgot password?
            </p>
          )}

          {/* Login button */}
          <button
            className="hb-login-btn"
            onClick={handleLogin}
            disabled={loading}
            style={{
              width:'100%', padding:'12px',
              borderRadius:50, border:'none',
              background: loading
                ? 'rgba(180,80,80,0.5)'
                : 'linear-gradient(135deg, #C0392B 0%, #922B21 50%, #C0392B 100%)',
              backgroundSize:'200% auto',
              color:'white', fontSize:13,
              fontFamily:"'Lato',sans-serif",
              fontWeight:700, letterSpacing:3,
              textTransform:'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow:'0 6px 24px rgba(160,40,40,0.3)',
              transition:'all 0.3s ease',
              marginBottom:10,
              animation: !loading ? 'shimmer 3s linear infinite' : 'none',
            }}
          >
            {loading ? '✨ Signing in...' : 'Sign In'}
          </button>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', marginBottom:8, gap:10 }}>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg, transparent, rgba(200,130,130,0.3))' }}/>
            <span style={{ fontSize:10, color:'rgba(160,80,80,0.5)', fontFamily:"'Lato',sans-serif", letterSpacing:2 }}>or</span>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg, rgba(200,130,130,0.3), transparent)' }}/>
          </div>

          {/* Google */}
          <button
            className="hb-google-btn"
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width:'100%', padding:'10px',
              borderRadius:50,
              border:'1px solid rgba(200,150,150,0.35)',
              background:'rgba(255,255,255,0.8)',
              color:'#5C2020',
              fontSize:13, cursor:'pointer',
              fontFamily:"'Lato',sans-serif",
              fontWeight:400, letterSpacing:'0.3px',
              marginBottom:12,
              display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              transition:'all 0.25s ease',
              boxShadow:'0 2px 10px rgba(0,0,0,0.05)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.6 0-14.2 4.1-17.7 10.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.8 39.9 16.5 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.5 35.6 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Continue with Google
          </button>

          {/* Sign up link */}
          <p style={{ textAlign:'center', margin:0, fontFamily:"'Lato',sans-serif", fontSize:12, color:'rgba(120,50,50,0.6)', fontWeight:300 }}>
            New to Hello Babe?{' '}
            <span
              className="hb-signup-link"
              onClick={onSignup}
              style={{
                color:'#C0392B', cursor:'pointer', fontWeight:700,
                letterSpacing:'0.5px', transition:'letter-spacing 0.3s ease',
                fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:14,
              }}
            >
              Create your story →
            </span>
          </p>
        </div>

        {/* ── MADE BY ── */}
        <div style={{
          marginTop:8, textAlign:'center', zIndex:2, position:'relative',
          opacity: mounted ? 1 : 0,
          animation: mounted ? 'fadeUp 0.9s 0.35s ease both' : 'none',
        }}>
          <p style={{ fontFamily:"'Lato',sans-serif", fontSize:9, letterSpacing:4, color:'rgba(160,80,80,0.45)', margin:'0 0 4px', textTransform:'uppercase', fontWeight:300 }}>Crafted with love by</p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <span style={{
              fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontWeight:600, fontSize:18,
              color:'rgba(80,20,20,0.7)',
              letterSpacing:2, fontStyle:'italic',
            }}>Ganesh</span>
            <svg viewBox="0 0 30 40" width="14" height="20" style={{ transform:'rotate(-90deg)', opacity:0.8 }}>
              <polygon points="0,0 0,22 20,22" fill="#DC143C" stroke="#003893" strokeWidth="1.5"/>
              <polygon points="0,22 0,38 24,22" fill="#DC143C" stroke="#003893" strokeWidth="1.5"/>
              <circle cx="6" cy="10" r="3.5" fill="white"/><circle cx="8" cy="9" r="2.8" fill="#DC143C"/>
              <circle cx="8" cy="28" r="3.5" fill="white"/><circle cx="8" cy="28" r="2" fill="#DC143C"/>
            </svg>
          </div>
        </div>

        {/* Bottom decorative line */}
        <div style={{ position:'absolute', bottom:0, width:'100%', zIndex:2 }}>
          <div style={{ height:2, background:'linear-gradient(90deg, transparent, #C0392B, #D4A853, #C0392B, transparent)' }}/>
        </div>
      </div>
    </>
  );
}

export default Login;