/**
 * A tiny 3D projection used by the hero's peer-network visual.
 *
 * WHY NOT WebGL: the whole scene is a dozen nodes and a handful of curves.
 * Running it through CSS transforms keeps everything on the compositor,
 * adds nothing to the bundle, and — in an app whose main job is decoding
 * video — avoids putting a WebGL context in contention for the GPU.
 *
 * The maths below is a standard Y-then-X rotation followed by a weak
 * perspective divide, which is enough to get real depth: far nodes are
 * smaller, dimmer, blurrier, and correctly occluded by painting order.
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Projected {
  /** Screen-space offsets from the scene centre, in pixels. */
  x: number;
  y: number;
  /** Perspective factor: >1 nearer than the origin plane, <1 further. */
  scale: number;
  /** Rotated depth, for sorting and depth cues. */
  z: number;
}

export interface SceneRotation {
  rotY: number;
  rotX: number;
}

export function project(
  p: Point3D,
  { rotY, rotX }: SceneRotation,
  perspective: number,
): Projected {
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);

  // Rotate about the Y axis (turntable), then about X (tilt).
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;

  const y2 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;

  // Weak perspective. Clamped so a node passing behind the camera plane
  // cannot produce a negative or explosive scale.
  const k = perspective / Math.max(perspective + z2, perspective * 0.25);

  return { x: x1 * k, y: y2 * k, scale: k, z: z2 };
}

/** Maps rotated depth to an opacity cue. Far things recede. */
export function depthOpacity(z: number, spread = 420): number {
  const t = (z + spread) / (spread * 2);
  return 0.35 + (1 - Math.min(Math.max(t, 0), 1)) * 0.65;
}

/** Maps rotated depth to a blur radius in px. Only far things blur. */
export function depthBlur(z: number, spread = 420, max = 3.5): number {
  const t = (z + spread) / (spread * 2);
  return Math.min(Math.max(t, 0), 1) * max;
}

/**
 * Quadratic bezier point. Connection lines bow outward so two nodes never
 * read as a flat straight rod, and packets follow the same curve exactly.
 */
export function quadPoint(
  ax: number, ay: number,
  cxp: number, cyp: number,
  bx: number, by: number,
  t: number,
): { x: number; y: number } {
  const inv = 1 - t;
  return {
    x: inv * inv * ax + 2 * inv * t * cxp + t * t * bx,
    y: inv * inv * ay + 2 * inv * t * cyp + t * t * by,
  };
}

/** Control point for a curve between two projected nodes, bowed by `bend`. */
export function controlPoint(
  ax: number, ay: number,
  bx: number, by: number,
  bend: number,
): { x: number; y: number } {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset, scaled by the distance so short links bow less.
  return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
}
