function getRandomNot0() {
  let res = Math.random();
  // there is a 2^1024 chance that res === 0, so this is VERY UNLIKELY to ever be an infinite loop
  while (res === 0) res = Math.random();
  return res;
}

function getRandomBetween(min: number, max: number) {
  return getRandomNot0() * (max - min) + min;
}

export function insertSeq(prevSeq?: number, nextSeq?: number): number {
  if (prevSeq && nextSeq) {
    // have both
    const buffer = (nextSeq - prevSeq) / 3;
    const min = prevSeq + buffer;
    const max = nextSeq - buffer;
    return getRandomBetween(min, max);
  } else if (nextSeq) {
    // have next
    return nextSeq - getRandomBetween(0.25, 0.75);
  } else {
    // missing one or both
    return (prevSeq || 0) + getRandomBetween(0.25, 0.75);
  }
}
