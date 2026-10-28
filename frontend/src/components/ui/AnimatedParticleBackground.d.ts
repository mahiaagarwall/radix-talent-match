// Types for the JSX component so TypeScript feature code (Company Directory) can use it.
import type { JSX } from 'react';

export interface AnimatedParticleBackgroundProps {
  /** Particles at the reference size (1280×420); scaled by area and device. 0–600. */
  particleCount?: number;
  /** Drift speed multiplier. 0–5. */
  speed?: number;
  /** Respond to the pointer (ignored for touch and reduced motion). */
  interactive?: boolean;
  /** Maximum parallax shift in px for the nearest particles. 0–60. */
  parallaxStrength?: number;
  /** Radius in px within which particles move away from the pointer. 0–400. */
  interactionRadius?: number;
  /** Strength of that displacement. 0–1. */
  interactionStrength?: number;
  className?: string;
}

export function AnimatedParticleBackground(props: AnimatedParticleBackgroundProps): JSX.Element;
