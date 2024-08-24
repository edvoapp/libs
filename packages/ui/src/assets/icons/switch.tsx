import { FunctionComponent, JSX } from 'preact';

export const Switch: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M5.5 14V4C5.5 3.17157 6.17157 2.5 7 2.5H11H15C15.8284 2.5 16.5 3.17157 16.5 4V14C16.5 14.8284 15.8284 15.5 15 15.5H7C6.17157 15.5 5.5 14.8284 5.5 14Z"
      stroke="#1F1C20"
    />
    <path
      d="M8.80054 8.79875L8.20036 9.39893C7.53742 10.0619 7.53742 11.1367 8.20036 11.7996V11.7996C8.8633 12.4626 9.93813 12.4626 10.6011 11.7996L11.2013 11.1995"
      stroke="#1F1C20"
    />
    <path
      d="M10.7971 6.80054L11.3973 6.20036C12.0602 5.53742 13.1351 5.53742 13.798 6.20036V6.20036C14.461 6.8633 14.461 7.93813 13.798 8.60107L13.1978 9.20125"
      stroke="#1F1C20"
    />
    <path d="M10 10L12.1213 7.87868" stroke="#1F1C20" />
    <path d="M4 5V15C4 16.1046 4.89543 17 6 17H14" stroke="#1F1C20" />
  </svg>
);
