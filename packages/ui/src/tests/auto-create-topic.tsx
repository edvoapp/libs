import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';
import { Model, trxWrap } from '@edvoapp/common';
import { useAwait } from '@edvoapp/util';

export const TestAutoCreateTopic = ({ name, shareType }: { name: string; shareType?: 'allow' | 'deny' }) => {
  const vertex = useAwait(async () => {
    return await trxWrap(async (trx) => {
      const v = Model.Vertex.create({ name, trx });
      if (shareType) {
        Model.Priv.Share.create({
          trx,
          vertex: v,
          data: {
            shareType,
            shareCategory: 'read',
            targetUserID: 'PUBLIC',
            contextId: v.id,
          },
        });
      }
      return v;
    });
  }, []);

  useEffect(() => {
    if (vertex) {
      console.log('TRACE:navigated');
      route(`/topic/${vertex.id}`);
    }
  }, [vertex]);

  return null;
};
