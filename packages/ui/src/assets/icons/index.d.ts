declare module '*.svg' {
  import Preact = require('preact');
  export const PreactComponent: Preact.FunctionComponent<Preact.JSX.SVGAttributes>;
  const src: string;
  export default src;
}
