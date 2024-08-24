import { FunctionComponent, JSX } from 'preact';

export const Focus: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    {...props}
  >
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="12" cy="12" r="4.5" stroke-dasharray="2 4" />
    <path d="M10 4H7C5.34315 4 4 5.34315 4 7V10" />
    <path d="M14 4H17C18.6569 4 20 5.34315 20 7V10" />
    <path d="M10 20H7C5.34315 20 4 18.6569 4 17V14" />
    <path d="M14 20H17C18.6569 20 20 18.6569 20 17V14" />
  </svg>
);
