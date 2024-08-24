import { FunctionComponent, JSX } from 'preact';

export const FullScreen: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M13 11L18 6" stroke="#A89FAB" stroke-linecap="round" />
    <path d="M13 6H18V11" stroke="#A89FAB" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M10 6H9C7.34315 6 6 7.34315 6 9V10" stroke="#A89FAB" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M11 13.125L6 18" stroke="#A89FAB" stroke-linecap="round" />
    <path d="M11 18H6V13" stroke="#A89FAB" stroke-linecap="round" stroke-linejoin="round" />
    <path
      d="M14 18H15C16.6569 18 18 16.6569 18 15V14"
      stroke="#A89FAB"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);
