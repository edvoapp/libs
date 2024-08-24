import { Point } from './wgpu';

export function calculateHypotenuse(p1: Point, p2: Point): number {
  const a = p1.y - p2.y; // opposite or rise
  const b = p1.x - p2.x; // adjacent or run
  return a * a + b * b;
}
