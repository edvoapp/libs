import { FunctionComponent, JSX } from 'preact';

export const MinusIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" {...props}>
    <path d="M0 0h24v24H0V0z" fill="none" />
    <path d="M19 13h-8H5v-2h14v2z" />
  </svg>
);
