import { FunctionComponent, JSX } from 'preact';

export const HamburgerIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg viewBox="0 0 100 80" width="40" height="40" {...props}>
    <rect width="100" height="20"></rect>
    <rect y="30" width="100" height="20"></rect>
    <rect y="60" width="100" height="20"></rect>
  </svg>
);

export default HamburgerIcon;
