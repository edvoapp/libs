import { FunctionComponent, JSX } from 'preact';

export const MouseIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="12" height="17" viewBox="0 0 12 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7 0.5C9.75 0.5 12 2.75 12 5.5V11.5C12 14.2812 9.75 16.5 7 16.5H5C2.21875 16.5 0 14.2812 0 11.5V5.5C0 2.75 2.21875 0.5 5 0.5H7ZM10.5 11.5V5.5C10.4688 3.59375 8.90625 2.03125 7 2H5C3.0625 2.03125 1.5 3.59375 1.5 5.5V11.5C1.5 13.4375 3.0625 15 5 15H7C8.90625 15 10.4688 13.4375 10.5 11.5ZM6 3.5C6.53125 3.5 7 3.96875 7 4.5V5.5C7 6.0625 6.53125 6.5 6 6.5C5.4375 6.5 5 6.0625 5 5.46875V4.5C5 3.9375 5.4375 3.5 6 3.5Z" />
  </svg>
);
