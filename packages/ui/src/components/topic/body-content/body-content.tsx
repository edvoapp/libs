import { VM } from '../../..';
import { Img } from './img';
import { Pdf } from './pdf';
import { Svg } from './svg';
import { Uri } from './uri';
import { Text } from './text';
import { useSharedProperty } from '../../../hooks/useSharedState';
import { Html } from './html';
import { useObserveValue } from '@edvoapp/util';
import { Icon } from './icon';
import styled from 'styled-components';
import cx from 'classnames';

export type DisplayModuleProps = {
  node: VM.BodyContent;
  sharedCx: string;
};

type Props = {
  node: VM.BodyContent;
};

const IconRoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const BodyContent = ({ node }: Props) => {
  const prop = useObserveValue(() => node.property, [node], 'useObserveValue(() => BodyContent.property)');
  if (!prop) return null;

  const { contentType } = prop;
  const { sharedCx } = useSharedProperty(prop);
  let modProps: DisplayModuleProps = {
    node,
    sharedCx,
  };

  const appearance = useObserveValue(() => node.appearance, [node]);
  const color = appearance?.textColor;

  const text = useObserveValue(() => node.textField, [node]);
  const icon = useObserveValue(() => node.icon, [node]);

  if (text) {
    // just to bind the body content
    return (
      <div
        ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
        className={cx('body h-full flex items-center', appearance?.type === 'stickynote' && 'text-center')}
        style={{ color }}
      >
        <Text node={text} />
      </div>
    );
  }
  if (icon) {
    // just to bind the body content
    return (
      <IconRoot ref={(r: any) => node.safeBindDomElement(r)}>
        <Icon node={icon} />
      </IconRoot>
    );
  }

  // later implement all of these as their own content-type specific vm nodes and clone the above
  switch (contentType) {
    // case 'text/plain':
    //   return <Text {...modProps, node: node.text} />;
    case 'text/haml':
    case 'text/html':
      return <Html {...modProps} />;
    case 'text/x-uri':
    case 'text/x-embed-uri':
      return <Uri {...modProps} />;
    case 'application/pdf':
      return <Pdf {...modProps} />;
    case 'image/gif':
    case 'image/jpg':
    case 'image/jpeg':
    case 'image/png':
      return <Img {...modProps} />;
    case 'image/svg+xml':
      return <Svg {...modProps} />;
  }
  return null;
};
