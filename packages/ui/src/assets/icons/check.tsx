import { FunctionComponent, JSX } from 'preact';

export const Check: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="14px" width="9px" viewBox="0 0 14 9" fill="currentColor" {...props}>
    <path d="M12.9062 0.566406C13.1797 0.839844 13.1797 1.25 12.9062 1.49609L5.6875 8.71484C5.44141 8.98828 5.03125 8.98828 4.78516 8.71484L1.06641 4.99609C0.792969 4.75 0.792969 4.33984 1.06641 4.06641C1.3125 3.82031 1.72266 3.82031 1.96875 4.06641L5.25 7.34766L12.0039 0.566406C12.25 0.320312 12.6602 0.320312 12.9062 0.566406Z" />
  </svg>
);
