import { FunctionComponent, JSX } from 'preact';

export const TemplateIcon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg height="24px" viewBox="0 0 24 24" width="24px" fill="#000000" {...props}>
    <path d="M0 0h24v24H0zm10 5h4v2h-4zm0 0h4v2h-4z" fill="none" />
    <path d="M10 16v-1H3.01L3 19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-4h-7v1h-4zm10-9h-4.01V5l-2-2h-4l-2 2v2H4c-1.1 0-2 .9-2 2v3c0 1.11.89 2 2 2h6v-2h4v2h6c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 0h-4V5h4v2z" />
  </svg>
);
