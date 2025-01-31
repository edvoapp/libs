import { FunctionComponent, JSX } from 'preact';

export const CheckboxChecked: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="8" y="8" width="16" height="16" rx="4" fill="#783DF6" />
    {/*<rect x="8" y="8" width="16" height="16" rx="4" fill="currentColor" />*/}
    <path d="M10.667 16L14.2225 20L21.3337 12" stroke="white" stroke-linecap="round" />
  </svg>
);
