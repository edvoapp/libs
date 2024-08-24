import { FunctionComponent, JSX } from 'preact';

export const DownloadIcon: FunctionComponent<JSX.SVGAttributes> = (props) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      {...props}
    >
      <path d="M20 16V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V16" stroke-linecap="round" />
      <path d="M12 16V4" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M8 12L12 16L16 12" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
};
