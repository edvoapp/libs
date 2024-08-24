// TODO: Make this more general?
export function generateBrightColor(): number[] {
  const hue = generateRandomNumber(1, 360);

  const rgb = HSLToRGB(hue, 100, 50);

  console.log(hue, rgb);
  return rgb;
  // const min1 = red - 42;
  // const max1 = red + 42;

  // const green = generateRandomNumber(
  //   min1 > 190 ? min1 : 190,
  //   max1 < 255 ? max1 : 255,
  // );

  // const baseMin = Math.min(red, green);
  // const baseMax = Math.max(red, green);

  // const min2 = baseMin - 42;
  // const max2 = baseMax + 42;

  // const blue = generateRandomNumber(
  //   min2 > 190 ? min2 : 190,
  //   max2 < 255 ? max2 : 255,
  // );

  // return [red, green, blue];
}

export function generateRandomNumber(min = 0, max = 100) {
  let diff = max - min;
  let rand = Math.random();
  rand = Math.floor(rand * diff);
  rand = rand + min;
  return rand;
}

export function HSLToRGB(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}
