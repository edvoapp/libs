import cx from 'classnames';
import { ComponentChildren } from 'preact';
import './viewer.scss';

export interface ViewerProps {
  children: ComponentChildren;
  className?: string;
}

export const Viewer = ({ children, className }: ViewerProps) => {
  return <div className={cx('viewer', className)}>{children}</div>;
};
