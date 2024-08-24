import { FunctionComponent, JSX } from 'preact';

export const DockIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor" {...props}>
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
  </svg>
);
