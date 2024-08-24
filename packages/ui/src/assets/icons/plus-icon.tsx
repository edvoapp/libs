import { FunctionComponent, JSX } from 'preact';

export const PlusIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" height={24} width={24} viewBox="0 0 448 512" fill="#000000" {...props}>
    <path d="M240 64c0-8.8-7.2-16-16-16s-16 7.2-16 16V240H32c-8.8 0-16 7.2-16 16s7.2 16 16 16H208V448c0 8.8 7.2 16 16 16s16-7.2 16-16V272H416c8.8 0 16-7.2 16-16s-7.2-16-16-16H240V64z" />
  </svg>
);
