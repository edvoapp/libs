import { h, FunctionComponent, JSX } from 'preact';

export const HomeIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor" {...props}>
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

export default HomeIcon;
