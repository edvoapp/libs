import { Guard, useAwait, useObserveValue } from '@edvoapp/util';
import { trxWrap } from '@edvoapp/common';
import { useEffect } from 'preact/hooks';
import { Skeleton } from '../../skeleton';
import { DisplayModuleProps } from './body-content';
import { isSized } from '../../../viewmodel';

export const Img = ({ node }: DisplayModuleProps) => {
  // we need a url TO the content

  const property = useObserveValue(() => node.property, [node]);
  if (!property) return <Skeleton count={5} />;
  const url = useAwait(() => property.contentUrl(), [node]) as string;
  if (!url) return <Skeleton count={5} />;

  useEffect(() => {
    const image = new Image();
    image.src = url;
    image.addEventListener('load', async (evt) => {
      if (!node.alive) return;
      const g1 = Guard.unsafe(node);
      const parentNode = node.findClosest((n) => isSized(n) && n);
      if (parentNode) {
        const g2 = Guard.unsafe(parentNode);
        const { height: h, width: w } = evt.target as HTMLImageElement;
        const ratio = h / w;
        const existingSize = await parentNode.getSize();

        if (existingSize?.ratio) return;
        const { width = 300 } = existingSize;
        await trxWrap((trx) =>
          parentNode.setSize({
            trx,
            size: {
              ratio,
              width,
              height: width * ratio,
            },
          }),
        );
        g2.release();
      }
      g1.release();
    });
  }, [url, node]);

  return (
    <img
      className="display-module display-module-img"
      src={url}
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    />
  );
};
