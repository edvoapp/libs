import { firebase } from '../src/firebase';

import { Vertex } from '../src/model/vertex';
import { Entity, BaseData } from '../src/model/entity';
import { DocumentReference, Query } from '../src/firebase';
import equal from 'fast-deep-equal';
import canonical_json from 'canonicalize';
import * as jestConsole from '@jest/console';
import { getRolesFromRoleBase } from '../src/utils/roles';

export function sleep(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Simplify Jest's console output (typically to faciliate debugging).
 *
 * Usage:
 *
 *     import { beforeAll } from '@jest/globals';
 *     import { simplifyConsole } from './util';
 *     beforeAll(() => simplifyConsole());
 */
export function simplifyConsole() {
  function formatMessage(type: jestConsole.LogType, message: jestConsole.LogMessage) {
    return message
      .split(/\n/)
      .map((line) => '      ' + line)
      .join('\n');
  }
  global.console = new jestConsole.CustomConsole(process.stdout, process.stderr, formatMessage);
}

export async function testDiag(vertex: Vertex, det?: Determinizer): Promise<string> {
  const meta = await vertex.meta.get();
  const text = await vertex.bodyText();
  let out =
    `* ${det ? det.determinizeId('vertex:' + vertex.id) : vertex.prettyId()}=${text || '-'}` +
    (meta?.placeholderText ? `(${meta?.placeholderText})` : '') +
    '\n' +
    (await testDiagChildren(vertex, 1, det));

  return out;
}
export async function testDiagChildren(thing: Vertex, tier: number, det?: Determinizer): Promise<string> {
  const { itemRole } = getRolesFromRoleBase('category');
  const itembackrefs = await thing.filterBackrefs({ role: [itemRole] }).toArray();
  itembackrefs.sort((a, b) => a.seq - b.seq);

  let out = '';
  // console.log(('  '.repeat(tier)) + `testDiagChildren(${thing.prettyId()}) 1`);
  // const iter = await itembackrefs.getIter();
  // console.log(('  '.repeat(tier)) + `testDiagChildren(${thing.prettyId()}) 2`, !iter.isEmpty());
  while (true) {
    const itemBackref = itembackrefs.shift();
    const childVertex = itemBackref?.target;

    if (!childVertex) break;

    const text = await childVertex.bodyText();

    const meta = await childVertex.meta.get();

    out =
      out +
      '  '.repeat(tier) +
      `* ${det ? det.determinizeId('vertex:' + childVertex.id) : childVertex.prettyId()}=${text || '-'}` +
      (meta?.placeholderText ? `(${meta?.placeholderText})` : '') +
      '\n' +
      (await testDiagChildren(childVertex, tier + 1, det));
  }

  return out;
}

export class Determinizer {
  readonly testId = Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '');
  readonly reverse: Record<string, string> = {};
  readonly map: Record<string, string> = {};
  incrementSets: Record<string, { increment: number }> = {};
  constructor(protected pad = 2) {}
  determinizeId(inputId: string): string {
    let determinized = this.map[inputId];
    if (determinized) return determinized;

    let [type, id] = inputId.split(':');
    let incSet = (this.incrementSets[type] = this.incrementSets[type] || {
      increment: 0,
    });
    incSet.increment += 1;

    let number = incSet.increment.toString();
    determinized = type + '0'.repeat(this.pad - number.length) + number;
    this.map[inputId] = determinized;
    this.reverse[determinized] = inputId;
    return determinized;
  }
  async expectDocs(collectionGroup: string, expect_items: Record<string, any>): Promise<void> {
    const firestore = firebase.app().firestore();
    const snapshot = await firestore
      .collectionGroup(collectionGroup)
      .where('meta.testId', '==', this.testId)
      .orderBy('meta.testSeq')
      .get({ source: 'server' });

    snapshot.docs.forEach((doc) => {
      const id = this.determinizeId(`${collectionGroup}:${doc.id}`);

      const expect_data = expect_items[id] as any;
      delete expect_items[id];

      const recordData = doc.data();
      let compare_data;
      if (recordData) {
        compare_data = Object.keys(expect_data).reduce((result, key) => {
          if (typeof recordData[key] !== 'undefined') {
            result[key] = recordData[key];
          }
          return result;
        }, {} as any);

        if (compare_data.meta) {
          delete compare_data.meta.testSeq;
          delete compare_data.meta.testId;
        }
      }

      if (!expect_data) {
        throw `${id} not present in expected set. \n Got:\n ${id} => ${JSON.stringify(compare_data)}`;
      }

      if (!equal(expect_data, compare_data)) {
        // console.log('Expect:', expect_data)
        // console.log('Compare:', compare_data)
        throw `${id} does not match.\nExpected:\n ${canonical_json(expect_data)} \nGot:\n ${canonical_json(
          compare_data,
        )}`;
      }
    });
    const remainingItems = Object.keys(expect_items);
    if (remainingItems.length > 0) {
      throw `The following items were not present in the database: ${remainingItems.join(',')}`;
    }
  }
  revId(determinizedId: string): string {
    const realId = this.reverse[determinizedId];
    if (!realId) throw 'Entry not found for ${determinizedId}';
    return realId.replace(/^.*?:/, '');
  }
}

// export interface DummyDbData extends BaseData { }

// /**
//  * Minimal Transactable document type for testing entities functionality.
//  */
// export class Dummy extends Entity<DummyDbData> {
//   readonly type = 'dummy';

//   constructor(args: ConstructorArgs<DummyDbData>) {
//     super(args);
//     const firestore = firebase.app().firestore();
//     const docRef = firestore.collection('dummy').doc() as DocumentReference<DummyDbData>;
//   }

//   /**
//    * Create an empty Dummy object.
//    */
//   static make() {
//     const firestore = firebase.app().firestore();
//     const docRef = firestore.collection('dummy').doc() as DocumentReference<DummyDbData>;
//     return new Dummy({ docRef: docRef });
//   }

//   /**
//    * Create a Firestore Query against the `dummy` collection where `key` equals `value`.
//    */
//   static async matchAttribute(key: string, value: string) {
//     const firestore = firebase.firestore();
//     let query = firestore.collection('dummy').where(key, '==', value) as Query<DummyDbData>;
//     return query.get();
//   }

//   /**
//    * Delete all Dummy records where `key` equals `value`.
//    */
//   static async deleteMatching(key: string, value: string) {
//     let snapshot = await Dummy.matchAttribute(key, value);
//     snapshot.forEach(async (result) => await result.ref.delete());
//     return snapshot.size;
//   }

//   /**
//    * Return a count of how many Dummy records exist where `key` equals `value`.
//    */
//   static async countMatching(key: string, value: string) {
//     let snapshot = await Dummy.matchAttribute(key, value);
//     return snapshot.size;
//   }
// }
