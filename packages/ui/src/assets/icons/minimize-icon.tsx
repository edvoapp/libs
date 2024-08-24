import { FunctionComponent, JSX } from 'preact';

export const MinimizeIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor" {...props}>
    <path d="M0 0h24v24H0V0z" fill="none" />
    <path d="M6 19h12v2H6z" />
  </svg>
);
