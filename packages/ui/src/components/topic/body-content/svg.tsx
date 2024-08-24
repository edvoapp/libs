import { useAwait, useObserve, useObserveValue } from '@edvoapp/util';
import { Skeleton } from '../../skeleton';
import { DisplayModuleProps } from './body-content';

export const Svg = ({ node }: DisplayModuleProps) => {
  // we need a url TO the content
  const property = useObserveValue(() => node.property, [node]);
  if (!property) return <Skeleton count={5} />;
  const url = useAwait(() => property.contentUrl(), [node]);
  if (!url) return <Skeleton count={5} />;

  // For safety, don't embed the raw svg in the document
  return (
    <div
      style={{
        backgroundImage: `url(${url})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        height: '100%',
        width: '100%',
      }}
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    />
  );
};
