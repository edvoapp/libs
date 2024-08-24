import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import cx from 'classnames';

import { DisplayModuleProps } from './body-content';

export function Html({ node, sharedCx }: DisplayModuleProps) {
  const propertyValue = useObserveValue(() => node.property, [node]);
  const bodyText = useObserveValueMaybe(() => propertyValue?.text, [propertyValue]);
  if (bodyText === undefined) return null;
  return (
    <div
      className={cx('html-content', sharedCx)}
      dangerouslySetInnerHTML={{ __html: bodyText || '' }}
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    />
  );
}
