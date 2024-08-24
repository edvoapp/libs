import Color from 'color';

export { Color };

export function getMaxContrastColor(color: Color, colors: Color[]): Color {
  let maxContrast = 0;
  let contrastColor = Color('#fff');
  for (const c of colors) {
    const contrast = color.contrast(c);
    if (contrast > maxContrast) {
      maxContrast = contrast;
      contrastColor = c;
    }
  }
  return contrastColor;
}

export function getContrastColor(bgColor: string): string {
  const bg = Color(bgColor);
  const possibleColors = Array.from({ length: 10 }, (_, x) => [
    bg.negate().lighten(x / 10),
    bg.negate().darken(x / 10),
  ]).reduce((a, b) => a.concat(b), []);
  return getMaxContrastColor(bg, possibleColors).hexa();
  // let fg = '';
  // let maxContrast = 0;
  // const greyscales = '0123456789abcdef'.split('').map((c) => `#${c.repeat(6)}`);
  // for (const greyscale of greyscales) {
  //   const contrast = bg.contrast(Color(greyscale));
  //   if (contrast > maxContrast) {
  //     maxContrast = contrast;
  //     fg = greyscale;
  //   }
  // }
  // console.table({
  //   backgroundColor: bgColor,
  //   contrast: maxContrast,
  //   textColor: fg,
  //   contrastLevel: bg.level(Color(fg)),
  // });
  // return fg;
}
