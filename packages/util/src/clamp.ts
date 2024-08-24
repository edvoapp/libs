export function clamp(min: number, max: number, val: number) {
  if (min > max) {
    console.warn('Min must be less than max, min:', min, 'max:', max);
    return clamp(max, min, val);
  }
  if (val < min) return min;
  if (val > max) return max;
  return val;
}
