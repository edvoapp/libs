import { FunctionComponent, JSX } from 'preact';

export const ArrowDown: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="11px" width="6px" viewBox="0 0 11 6" fill="currentColor" {...props}>
    <path d="M10.0938 1.71094L5.9375 5.62109C5.80078 5.75781 5.63672 5.8125 5.5 5.8125C5.33594 5.8125 5.17188 5.75781 5.03516 5.64844L0.878906 1.71094C0.605469 1.46484 0.605469 1.05469 0.851562 0.78125C1.09766 0.507812 1.50781 0.507812 1.78125 0.753906L5.5 4.25391L9.19141 0.753906C9.46484 0.507812 9.875 0.507812 10.1211 0.78125C10.3672 1.05469 10.3672 1.46484 10.0938 1.71094Z" />
  </svg>
);
