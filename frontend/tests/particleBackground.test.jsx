import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedParticleBackground } from '../src/components/ui/AnimatedParticleBackground';
import { ThemeProvider } from '../src/context/ThemeContext';

// Fake 2D context and frame scheduler so the loop can be driven deterministically.
let ctx;
let frames;
let nextId;
let reducedMotion;
let observers;

function setup({ width = 800, height = 300 } = {}) {
  ctx = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
  vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);
  vi.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON() {},
  }));
  frames = new Map();
  nextId = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  window.matchMedia = (query) => ({
    matches: query.includes('reduce') ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  observers = [];
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  };
}

const tick = (ms) => {
  const pending = [...frames.entries()];
  frames.clear();
  for (const [, cb] of pending) cb(ms);
};

const renderIn = (ui) =>
  render(
    <ThemeProvider>
      <div style={{ position: 'relative' }}>{ui}</div>
    </ThemeProvider>,
  );

beforeEach(() => {
  reducedMotion = false;
});
afterEach(() => {
  delete globalThis.IntersectionObserver;
});

describe('AnimatedParticleBackground', () => {
  it('is a decorative, non-interactive canvas', () => {
    setup();
    const { getByTestId } = renderIn(<AnimatedParticleBackground />);
    const canvas = getByTestId('particle-background');
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas).toHaveClass('particle-bg');
    const css = readFileSync('src/components/ui/AnimatedParticleBackground.css', 'utf8');
    expect(css).toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/position:\s*absolute/);
  });

  it('runs one time-based loop, scales for DPR, and cleans everything up on unmount', () => {
    setup();
    window.devicePixelRatio = 3;
    const removeWin = vi.spyOn(window, 'removeEventListener');
    const removeDoc = vi.spyOn(document, 'removeEventListener');
    const { unmount, getByTestId } = renderIn(<AnimatedParticleBackground particleCount={100} />);
    const canvas = getByTestId('particle-background');
    expect(canvas.width).toBe(1600); // DPR capped at 2
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(frames.size).toBe(1);

    const arcsBefore = ctx.arc.mock.calls.length;
    act(() => tick(1000));
    act(() => tick(1016));
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(arcsBefore);
    expect(frames.size).toBe(1); // still exactly one scheduled frame

    unmount();
    expect(frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(removeWin).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    window.devicePixelRatio = 1;
  });

  it('keeps a single loop under React Strict Mode double mounting', () => {
    setup();
    render(
      <StrictMode>
        <ThemeProvider>
          <div>
            <AnimatedParticleBackground />
          </div>
        </ThemeProvider>
      </StrictMode>,
    );
    expect(frames.size).toBe(1);
    act(() => tick(16));
    expect(frames.size).toBe(1);
  });

  it('draws a single static frame and never animates with reduced motion', () => {
    reducedMotion = true;
    setup();
    renderIn(<AnimatedParticleBackground />);
    expect(ctx.arc).toHaveBeenCalled(); // static field is still visible
    expect(frames.size).toBe(0);
  });

  it('pauses while the tab is hidden and resumes afterwards', () => {
    setup();
    renderIn(<AnimatedParticleBackground />);
    expect(frames.size).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(frames.size).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(frames.size).toBe(1);
  });

  it('pauses when scrolled off-screen', () => {
    setup();
    let io;
    globalThis.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; io = this; }
      observe() {}
      disconnect() {}
    };
    renderIn(<AnimatedParticleBackground />);
    expect(frames.size).toBe(1);
    act(() => io.cb([{ isIntersecting: false }]));
    expect(frames.size).toBe(0);
    act(() => io.cb([{ isIntersecting: true }]));
    expect(frames.size).toBe(1);
  });

  it('does nothing harmful with a zero-sized container, no canvas support, or invalid props', () => {
    setup({ width: 0, height: 0 });
    expect(() => renderIn(<AnimatedParticleBackground particleCount={-5} speed={Number.NaN} parallaxStrength="x" />)).not.toThrow();
    expect(frames.size).toBe(0);

    window.HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
    expect(() => renderIn(<AnimatedParticleBackground />)).not.toThrow();
  });

  it('eases pointer parallax instead of snapping', () => {
    setup();
    renderIn(<AnimatedParticleBackground particleCount={20} parallaxStrength={20} interactionStrength={0} />);
    act(() => tick(0));
    const firstX = () => ctx.arc.mock.calls.at(-1)[0];
    ctx.arc.mockClear();
    act(() => tick(16));
    const restX = firstX();
    act(() => window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 800, clientY: 300 })));
    ctx.arc.mockClear();
    act(() => tick(32));
    const oneFrameLater = firstX();
    expect(Math.abs(oneFrameLater - restX)).toBeLessThan(2); // small step, not a jump to the full offset
  });
});
