import { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import './AnimatedParticleBackground.css';

// Decorative ambient particle field drawn on a <canvas> that fills its positioned parent.
//
// - Time-based animation (delta time, clamped), one requestAnimationFrame loop per instance.
// - Particle state lives in typed arrays; nothing is allocated per frame and React never re-renders per frame.
// - Pointer parallax is eased in and out; the pointer is tracked on window (passive), and the canvas has
//   pointer-events: none, so it never blocks clicks, scrolling, text selection or keyboard use.
// - prefers-reduced-motion: one static frame, no loop, no pointer response.
// - Pauses while the tab is hidden or the parent is off-screen; resumes without a jump.
// - Density adapts to the area, touch devices and low core counts. DPR is capped.

const DPR_CAP = 2;
const MAX_DT = 0.05; // seconds; longer gaps (tab switch, jank) are clamped so nothing jumps
const REFERENCE_AREA = 1280 * 420;

const PALETTES = {
  dark: { colors: ['rgb(191, 219, 254)', 'rgb(196, 181, 253)', 'rgb(165, 180, 252)'], alpha: 0.8, glow: 0.14 },
  light: { colors: ['rgb(79, 70, 229)', 'rgb(99, 102, 241)', 'rgb(124, 58, 237)'], alpha: 0.38, glow: 0.06 },
};

const num = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function AnimatedParticleBackground({
  particleCount = 140,
  speed = 1,
  interactive = true,
  parallaxStrength = 10,
  interactionRadius = 120,
  interactionStrength = 0.12,
  className = '',
}) {
  const canvasRef = useRef(null);
  const { isDark } = useTheme();
  const paletteRef = useRef(isDark ? PALETTES.dark : PALETTES.light);
  const redrawRef = useRef(null);

  // Theme changes swap colours without reseeding (no visible jump).
  useEffect(() => {
    paletteRef.current = isDark ? PALETTES.dark : PALETTES.light;
    redrawRef.current?.();
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container || typeof window === 'undefined') return undefined;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return undefined; // unsupported: the container's CSS background remains

    const baseCount = Math.round(num(particleCount, 0, 600, 140));
    const speedScale = num(speed, 0, 5, 1);
    const parallax = num(parallaxStrength, 0, 60, 10);
    const radius = num(interactionRadius, 0, 400, 120);
    const push = num(interactionStrength, 0, 1, 0.12);

    const media = (q) => (window.matchMedia ? window.matchMedia(q) : null);
    const reducedMq = media('(prefers-reduced-motion: reduce)');
    const coarseMq = media('(pointer: coarse)');
    let reduced = Boolean(reducedMq?.matches);
    const pointerEnabled = () => interactive && !reduced && !coarseMq?.matches && (parallax > 0 || push > 0);

    // Particle state (structure of arrays).
    let n = 0;
    let px, py, vx, vy, size, alpha, phase, twinkle, depth, ox, oy, colorIdx;
    let width = 0;
    let height = 0;

    // Pointer: target (raw) and eased (rendered) positions, in container pixels.
    let targetX = 0;
    let targetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let influence = 0; // 0..1, eased presence of the pointer over the container
    let pointerInside = false;

    let frame = 0;
    let last = 0;
    let time = 0;
    let visible = true;
    let running = false;

    const targetCount = (w, h) => {
      let c = baseCount * Math.min(1.6, Math.max(0.2, (w * h) / REFERENCE_AREA));
      if (coarseMq?.matches || w < 640) c *= 0.55;
      const cores = navigator.hardwareConcurrency;
      if (cores && cores <= 4) c *= 0.75;
      return Math.round(c);
    };

    const seed = (count) => {
      n = count;
      px = new Float32Array(n);
      py = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      size = new Float32Array(n);
      alpha = new Float32Array(n);
      phase = new Float32Array(n);
      twinkle = new Float32Array(n);
      depth = new Float32Array(n);
      ox = new Float32Array(n);
      oy = new Float32Array(n);
      colorIdx = new Uint8Array(n);
      for (let i = 0; i < n; i += 1) {
        const d = 0.25 + Math.random() * 0.75; // far (small, dim, slow) .. near
        depth[i] = d;
        px[i] = Math.random() * width;
        py[i] = Math.random() * height;
        const angle = Math.random() * Math.PI * 2;
        const v = (2 + Math.random() * 6) * d; // px/s
        vx[i] = Math.cos(angle) * v;
        vy[i] = Math.sin(angle) * v - 1.5 * d; // faint upward drift
        size[i] = (0.35 + Math.random() * 1.1) * (0.6 + d * 0.8);
        alpha[i] = (0.25 + Math.random() * 0.75) * (0.45 + d * 0.55);
        phase[i] = Math.random() * Math.PI * 2;
        twinkle[i] = 0.4 + Math.random() * 1.4;
        colorIdx[i] = Math.floor(Math.random() * 3);
      }
    };

    const draw = () => {
      const palette = paletteRef.current;
      ctx.clearRect(0, 0, width, height);
      const parX = (pointerX / Math.max(1, width) - 0.5) * 2 * parallax * influence;
      const parY = (pointerY / Math.max(1, height) - 0.5) * 2 * parallax * influence;
      for (let i = 0; i < n; i += 1) {
        const d = depth[i];
        const x = px[i] + ox[i] - parX * d;
        const y = py[i] + oy[i] - parY * d;
        const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * twinkle[i] + phase[i]);
        const a = alpha[i] * tw * palette.alpha;
        ctx.fillStyle = palette.colors[colorIdx[i]];
        if (d > 0.85 && palette.glow > 0) {
          ctx.globalAlpha = a * palette.glow;
          ctx.beginPath();
          ctx.arc(x, y, size[i] * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, size[i], 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    redrawRef.current = () => {
      if (width > 0 && height > 0) draw();
    };

    const step = (dt) => {
      time += dt;
      const ease = 1 - Math.exp(-dt * 3); // smooth pointer follow, frame-rate independent
      pointerX += (targetX - pointerX) * ease;
      pointerY += (targetY - pointerY) * ease;
      influence += ((pointerInside && pointerEnabled() ? 1 : 0) - influence) * (1 - Math.exp(-dt * 2));
      const relax = Math.exp(-dt * 2.5);
      const margin = 8;
      const r2 = radius * radius;
      for (let i = 0; i < n; i += 1) {
        px[i] += vx[i] * dt * speedScale;
        py[i] += vy[i] * dt * speedScale;
        if (px[i] < -margin) px[i] += width + margin * 2;
        else if (px[i] > width + margin) px[i] -= width + margin * 2;
        if (py[i] < -margin) py[i] += height + margin * 2;
        else if (py[i] > height + margin) py[i] -= height + margin * 2;

        // Gentle displacement away from the pointer that springs back when it leaves.
        if (influence > 0.01 && push > 0 && radius > 0) {
          const dx = px[i] + ox[i] - pointerX;
          const dy = py[i] + oy[i] - pointerY;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < r2 && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const f = (1 - dist / radius) * push * influence * 60 * dt;
            ox[i] += (dx / dist) * f;
            oy[i] += (dy / dist) * f;
          }
        }
        ox[i] *= relax;
        oy[i] *= relax;
      }
    };

    const loop = (now) => {
      frame = 0;
      if (!running) return;
      const dt = last ? Math.min(MAX_DT, (now - last) / 1000) : 0;
      last = now;
      step(dt);
      draw();
      frame = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden || width === 0 || height === 0) return;
      running = true;
      last = 0; // first frame after (re)start uses dt = 0: no jump after a pause
      frame = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = () => {
      // The canvas's own box (inside the parent's border), so backing store and CSS size match exactly.
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w <= 0 || h <= 0) {
        width = 0;
        height = 0;
        stop();
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = targetCount(w, h);
      if (n === 0 || count !== n) {
        width = w;
        height = h;
        seed(count);
      } else {
        // Same density: rescale positions instead of reseeding, so resizes do not flash.
        const sx = w / (width || w);
        const sy = h / (height || h);
        for (let i = 0; i < n; i += 1) {
          px[i] *= sx;
          py[i] *= sy;
        }
        width = w;
        height = h;
      }
      draw();
      start();
    };

    const onPointerMove = (e) => {
      if (!pointerEnabled()) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointerInside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      if (pointerInside) {
        targetX = x;
        targetY = y;
      }
    };
    const onPointerLeave = () => {
      pointerInside = false;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onReducedChange = () => {
      reduced = Boolean(reducedMq?.matches);
      if (reduced) {
        stop();
        influence = 0;
        draw();
      } else start();
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    ro?.observe(container);
    if (!ro) window.addEventListener('resize', resize);

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting);
            if (visible) start();
            else stop();
          })
        : null;
    io?.observe(container);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMq?.addEventListener?.('change', onReducedChange);

    resize();

    return () => {
      stop();
      redrawRef.current = null;
      ro?.disconnect();
      io?.disconnect();
      if (!ro) window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMq?.removeEventListener?.('change', onReducedChange);
    };
  }, [particleCount, speed, interactive, parallaxStrength, interactionRadius, interactionStrength]);

  return <canvas ref={canvasRef} className={`particle-bg${className ? ` ${className}` : ''}`} aria-hidden="true" data-testid="particle-background" />;
}
