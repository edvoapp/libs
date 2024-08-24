import { setWasmBindings } from '@edvoapp/util';
import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import { firebase } from '../src/firebase';

import { Vertex } from '../src/model';
import { Env, init } from '../src/firebase';

// import { getRolesFromRoleBase, LinkedList } from '../src/internal';
import { Determinizer, simplifyConsole, sleep, testDiag } from './util';
import { trxWrap } from '../src/transaction';
import { globalStore } from '../src/dataset';

init({ env: Env.Staging, useEmulators: true });

beforeAll(async () => {
  globalStore.hackIgnoreActiveRemoves = true;
  simplifyConsole();
  const wasm = await import('@edvoapp/wasm-bindings');
  setWasmBindings(wasm);
});
afterAll(() => {
  firebase.app().delete();
});

describe('bulleted lists', () => {
  test.only('simple lists', async (done): Promise<void> => {
    const determinizer = new Determinizer();
    let [root, a, b, c] = await trxWrap(async (trx) => {
      let root = Vertex.create({ trx, meta: { placeholderText: 'Root' } });
      let a = Vertex.create({ trx, meta: { placeholderText: 'A' } });
      let b = Vertex.create({ trx, meta: { placeholderText: 'B' } });
      let c = Vertex.create({ trx, meta: { placeholderText: 'C' } });
      a.createEdge({ trx, target: root, role: ['category-item'], seq: 1 });
      c.createEdge({ trx, target: root, role: ['category-item'], seq: 3 });
      b.createEdge({ trx, target: root, role: ['category-item'], seq: 2 });
      return [root, a, b, c];
    });

    expect(await testDiag(root, determinizer)).toBe(
      '* vertex01=-(Root)\n  * vertex02=-(A)\n  * vertex03=-(B)\n  * vertex04=-(C)\n',
    );

    // Insert D between A and B
    let d = await trxWrap((trx) => {
      let d = Vertex.create({ trx, meta: { placeholderText: 'D' } });
      d.createEdge({ trx, target: root, role: ['category-item'], seq: 1.5 });
      return d;
    });

    expect(await testDiag(root, determinizer)).toBe(
      '* vertex01=-(Root)\n  * vertex02=-(A)\n  * vertex05=-(D)\n  * vertex03=-(B)\n  * vertex04=-(C)\n',
    );

    // Indent
    let edges = await b.getEdges(['category-item'], root.unifiedId);
    await trxWrap((trx) => {
      edges.forEach((e) => e.archive(trx));
      b.createEdge({ trx, target: d, role: ['category-item'], seq: 1 });
    });

    expect(await testDiag(root, determinizer)).toBe(
      '* vertex01=-(Root)\n  * vertex02=-(A)\n  * vertex05=-(D)\n    * vertex03=-(B)\n  * vertex04=-(C)\n',
    );

    // Unindent
    edges = await b.getEdges(['category-item'], d.unifiedId);
    await trxWrap((trx) => {
      edges.forEach((e) => e.archive(trx));
      b.createEdge({ trx, target: root, role: ['category-item'], seq: 2 });
    });

    expect(await testDiag(root, determinizer)).toBe(
      '* vertex01=-(Root)\n  * vertex02=-(A)\n  * vertex05=-(D)\n  * vertex03=-(B)\n  * vertex04=-(C)\n',
    );
    done!();
  });
});
