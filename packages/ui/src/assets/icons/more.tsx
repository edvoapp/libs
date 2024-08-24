import { FunctionComponent, JSX } from 'preact';

export const More: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="6" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="18" cy="12" r="2" />
  </svg>
);
