import { FunctionComponent, JSX } from 'preact';

export const Transclude: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="6" cy="6" r="1" fill="#1F1C20" />
    <circle cx="14" cy="14" r="1" fill="#1F1C20" />
    <rect x="3.5" y="3.5" width="13" height="5" rx="2.5" stroke="#1F1C20" />
    <rect x="3.5" y="11.5" width="13" height="5" rx="2.5" stroke="#1F1C20" />
  </svg>
);
