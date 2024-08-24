import firebase from 'firebase/compat/app';
import fs from 'fs';
import { Env, init, intersects } from '../../src';

init({ env: Env.StagingWebapp });

// -SrY1
//   vertex-t4xX [(category-head), (category-tail), (category-item)]
//     vertex-CaWp [(category-item)]
//       vertex-u9Vm [(category-head), (category-tail), (category-item)]

//       vertex-grmL [(category-prev)]
//         vertex-hCF7 [(category-tail), (category-item), (category-head)]

//     vertex-grmL [(category-tail), (category-item)]
//       vertex-hCF7 [(category-tail), (category-item), (category-head)]

//     vertex-ec7R [(category-head), (category-item)]
//       vertex-uogN [(category-tail), (category-head), (category-item)]

//       vertex-CaWp [(category-prev)]
//         vertex-u9Vm [(category-head), (category-tail), (category-item)]

//         vertex-grmL [(category-prev)]
//           vertex-hCF7 [(category-tail), (category-item), (category-head)]

async function dump(entityID: string, type: '' | 'vertex', recurseRoles: string[], filename: string) {
  const fd = fs.openSync(filename, 'a');
  const doneEntities = {};
  dump_recurse(entityID, type, recurseRoles, fd, doneEntities);
}
async function dump_recurse(
  entityID: string,
  type: '' | 'vertex',
  recurseRoles: string[],
  fd: number,
  doneEntities: any,
) {
  const firestore = firebase.firestore();

  const outputRecord: Record<string, any> = {
    type,
    id: entityID,
    parts: [],
    backrefs: [],
  };
  const entityDoc = firestore.collection(type).doc(entityID);
  const entityData = (await entityDoc.get()).data();

  outputRecord.body = entityData;

  const parts: any[] = [];
  const recurseVertexIDs: string[] = [];
  const recurseIDs: string[] = [];
  const partsRef = await entityDoc.collection(`${type}Part`).get();

  partsRef.forEach((doc) => {
    const docData = doc.data();
    const { status, role, payload } = docData;
    const { vertexID, ID } = JSON.parse(payload);
    if (status !== 'active' && intersects(recurseRoles, role)) {
      parts.push(docData);

      outputRecord.parts.push(docData);
    }
  });
  const backrefs: any[] = [];
  const backrefsRef = await entityDoc.collection('backref').get();
  backrefsRef.forEach((doc) => {
    const docData = doc.data();
    const { status, role, payload } = docData;
    const { vertexID, ID } = JSON.parse(payload);
    if (status !== 'active' && intersects(recurseRoles, role)) {
      backrefs.push(doc.data());
      outputRecord.backrefs.push(docData);
      if (vertexID && !doneEntities[vertexID]) {
        recurseVertexIDs.push(vertexID);
        doneEntities[vertexID] = true;
      }
      if (ID && !doneEntities[ID]) {
        recurseIDs.push(ID);
        doneEntities[ID] = true;
      }
    }
  });

  fs.writeSync(fd, JSON.stringify(outputRecord) + '\n', null);

  // now recurse

  recurseVertexIDs.forEach((vertexID) => {
    dump_recurse(vertexID, 'vertex', recurseRoles, fd, doneEntities);
  });

  recurseIDs.forEach((ID) => {
    dump_recurse(ID, '', recurseRoles, fd, doneEntities);
  });
}

// TODO: should slurp up a txt file and update the data
async function load(filename: string) {}

dump(
  't4xXrTsWhI6Wv4vHv9dw',
  'vertex',
  ['category-item', 'category-head', 'category-tail', 'category-prev'],
  '/Users/rasheedbustamam/Documents/coding/monorepo/packages/common/tests/template-1.txt',
).then(() => {
  console.log('done');
});

// One line per JSON doc
// { type: "vertex", id: "...", vertex: {..doc}, parts:[], backrefs:[] }
// { type: "", id: "...", : {..doc}, parts: [], backrefs []}
