import { FunctionComponent, JSX } from 'preact';

export const AddIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    stroke="currentColor"
  >
    <path d="M12.5 6V18" stroke-linecap="round" />
    <path d="M6.5 12H18.5" stroke-linecap="round" />
  </svg>
);
