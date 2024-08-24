import { FunctionComponent, JSX } from 'preact';

export const RefreshIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M15.2256 9.85742L17.6649 10.511L18.3185 8.07171"
      stroke="#A89FAB"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M16.8714 9.85714C16.5499 9.20448 16.086 8.62964 15.5185 8.16992C14.6172 7.43977 13.4545 7 12.1852 7C9.32149 7 7 9.23858 7 12C7 14.7614 9.32149 17 12.1852 17C13.7796 17 15.206 16.3061 16.1571 15.2143C16.5078 14.8118 16.7939 14.3552 17 13.8593"
      stroke="#A89FAB"
      stroke-linecap="round"
    />
  </svg>
);
