import { FunctionComponent, JSX } from 'preact';

export const PinIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8 12L5 15" stroke="#1F1C20" stroke-linecap="round" />
    <path
      d="M8.75699 8.0358C8.81986 8.01065 8.87697 7.97299 8.92486 7.92511L12.7893 4.06066C12.9846 3.8654 13.3011 3.8654 13.4964 4.06066L15.9393 6.50359C16.1346 6.69885 16.1346 7.01543 15.9393 7.2107L12.0749 11.0751C12.027 11.123 11.9894 11.1801 11.9642 11.243L11.099 13.4062C10.9657 13.7395 10.535 13.8279 10.2812 13.5741L6.42593 9.71882C6.17211 9.465 6.26051 9.03434 6.5938 8.90103L8.75699 8.0358Z"
      stroke="#1F1C20"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);
