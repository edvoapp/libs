import { FunctionComponent, JSX } from 'preact';

export const HighlighterIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    {...props}
  >
    <path
      d="M12.5974 15.6675L12.8748 16.0835L12.5974 15.6675L7.40477 19.1292C7.20646 19.2614 6.9424 19.2353 6.77386 19.0668L4.93324 17.2261C4.76471 17.0576 4.73856 16.7935 4.87077 16.5952L8.33253 11.4026C8.36021 11.3611 8.39394 11.3239 8.43261 11.2924L16.2015 4.95839C16.4004 4.79628 16.6896 4.81096 16.871 4.99237L19.0076 7.12895C19.189 7.31036 19.2037 7.59962 19.0416 7.79846L12.7076 15.5674C12.6761 15.6061 12.6389 15.6398 12.5974 15.6675Z"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="M5.5 18.5L5 19" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M8.5 11.5L12.5 15.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
