import { FunctionComponent, JSX } from 'preact';

export const CheckboxUnchecked: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" {...props}>
    <rect x="8.5" y="8.5" width="15" height="15" rx="3.5" fill="#F6F4F6" stroke="#D4CFD5" />
  </svg>
);
