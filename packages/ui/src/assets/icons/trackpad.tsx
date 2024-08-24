import { FunctionComponent, JSX } from 'preact';

export const TrackpadIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="16" height="13" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M14 0.5C15.0938 0.5 16 1.40625 16 2.5V10.5C16 11.625 15.0938 12.5 14 12.5H2C0.875 12.5 0 11.625 0 10.5V2.5C0 1.40625 0.875 0.5 2 0.5H14ZM14 2H2C1.71875 2 1.5 2.25 1.5 2.5V10.5C1.5 10.7812 1.71875 11 2 11H14C14.25 11 14.5 10.7812 14.5 10.5V2.5C14.5 2.25 14.25 2 14 2Z" />
  </svg>
);
