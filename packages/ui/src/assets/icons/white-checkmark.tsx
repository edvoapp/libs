import { FunctionComponent, JSX } from 'preact';

export const Checkmark: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor" {...props}>
    <path d="M6.00016 10.6698L2.53516 7.20485C2.14539 6.81508 1.51381 6.81397 1.12267 7.20235C0.729565 7.59268 0.728443 8.22813 1.12016 8.61985L6.00016 13.4998L17.295 2.20501C17.6844 1.81556 17.6844 1.18413 17.295 0.794677C16.9057 0.405355 16.2745 0.405206 15.885 0.794344L6.00016 10.6698Z" />
  </svg>
);
