import cx from 'classnames';
import { h } from 'preact';
import './mobile-layout.scss';

/**
 * Props for the MobileLayout component.
 */
interface MobileLayoutProps {
  noteForm: h.JSX.Element;
}

/**
 * Layout for the app on mobile devices.
 */
export function MobileLayout(props: MobileLayoutProps) {
  return (
    <main className={'mobileLayout'}>
      <div className={cx('spacer', 'flagTop')}>&nbsp;</div>
      <section className={'noteForm'}>{props.noteForm}</section>
      <div className={cx('spacer', 'flagBottom')}>&nbsp;</div>
    </main>
  );
}
