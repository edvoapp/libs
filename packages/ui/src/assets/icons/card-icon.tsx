import { FunctionComponent, JSX } from 'preact';

export const CardIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg height="24px" viewBox="0 0 24 24" width="24px" stroke="none" fill="none" {...props}>
    <path d="M23 15.7368V1H12H1V22H16.7143H23V15.7368Z" stroke="currentColor" />
    <circle cx="4.5" cy="5.5" r="1.5" fill="currentColor" />
    <circle cx="4.5" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="4.5" cy="15.5" r="1.5" fill="currentColor" />
    <line x1="7" y1="5.5" x2="19" y2="5.5" stroke="currentColor" />
    <line x1="7" y1="10.5" x2="19" y2="10.5" stroke="currentColor" />
    <line x1="7" y1="15.5" x2="19" y2="15.5" stroke="currentColor" />
  </svg>
);
