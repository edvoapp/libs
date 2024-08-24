import assert from 'assert';
import { initRoot } from '../utility/helpers-temp';
import { Model, trxWrap } from '@edvoapp/common';
import { backpack } from '../../fixtures/backpack';

// Feature test for PLM-2079 - Ensure that property size is properly saved to db
// https://edvo.atlassian.net/browse/PLM-2079

export async function FEAT2079() {
  await initRoot({ topicName: 'test', navToNewTopic: true });

  // TODO: cannot fetch from the browser
  // const contentArrayBuffer = await (
  //   await fetch('https://bitcoin.org/bitcoin.pdf', {
  //     mode: 'cors',
  //     method: 'POST',
  //   })
  // ).arrayBuffer();
  //
  // const prop1 = await helper({
  //   contentArrayBuffer,
  //   contentType: 'application/pdf',
  // });
  //
  // assert.ok(prop1.size);
  // // @ts-ignore
  // assert.ok(prop1.size > 0);

  const prop2 = await helper({
    contentHandle: backpack,
    contentType: 'image/jpeg',
  });

  assert.ok(prop2.size);
  // @ts-ignore
  assert.ok(prop2.size > 0);

  const prop3 = await helper({
    contentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    contentType: 'application/pdf',
  });

  assert.ok(prop3.size);
  // @ts-ignore
  assert.ok(prop3.size > 0);
}

const helper = async ({
  contentHandle,
  contentArrayBuffer,
  contentUrl,
  contentType,
}: {
  contentUrl?: string;
  contentHandle?: File;
  contentArrayBuffer?: ArrayBuffer;
  contentType: string;
}) =>
  trxWrap(async (trx) => {
    const parent = Model.Vertex.create({ trx });
    return Model.Property.createAsync({
      contentArrayBuffer,
      contentHandle,
      contentUrl,
      trx,
      parent,
      role: ['body'],
      contentType,
    });
  });
