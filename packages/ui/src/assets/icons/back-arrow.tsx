import { FunctionComponent, JSX } from 'preact';

export const BackArrow: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg height="11px" viewBox="0 0 7 11" width="7px" fill="currentColor" {...props}>
    <path
      d="M5.75 11C5.50391 11 5.28516 10.918 5.12109 10.7539L0.746094 6.37891C0.390625 6.05078 0.390625 5.47656 0.746094 5.14844L5.12109 0.773438C5.44922 0.417969 6.02344 0.417969 6.35156 0.773438C6.70703 1.10156 6.70703 1.67578 6.35156 2.00391L2.60547 5.75L6.35156 9.52344C6.70703 9.85156 6.70703 10.4258 6.35156 10.7539C6.1875 10.918 5.96875 11 5.75 11Z"
      fill="#18181B"
    />
  </svg>
);
