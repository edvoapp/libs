export function truncate(s: string) {
  return s.length > 25 ? `${s.slice(0, 25)}...` : s;
}
