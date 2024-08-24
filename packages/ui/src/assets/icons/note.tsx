import { FunctionComponent, JSX } from 'preact';

export const Note: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    {...props}
  >
    <rect x="5.5" y="3.5" width="13" height="17" rx="3.5" />
    <path d="M8 7H16" stroke-linecap="round" />
    <path d="M8 10H16" stroke-linecap="round" />
    <path d="M8 13H14" stroke-linecap="round" />
  </svg>
);
