import { FunctionComponent, JSX } from 'preact';

export const ArrowBackIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 6L8 10L12 14" stroke="#1F1C20" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
