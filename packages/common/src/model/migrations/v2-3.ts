import firebase from 'firebase/compat/app';
import { globalStore } from '../..';
// import { PropertyData } from '../entities/Property';
// import { ArtifactDataDB } from '../entities/Artifact';
// import { BackrefDataDB } from '../entities/Backref';
// import { ClaimDataDB } from '../entities/Claim';
// import { TimelineEventDataDB } from '../entities/TimelineEvent';
// import { EdgeDataDB } from '../entities/Edge';
// import { ShareData, UnifiedIdStruct } from '../entities/Entity';

/*

STUFF TO MIGRATE
[ ] convert ['member-of'] relationship to ['member-of, 'tag']
[ ] seq numbers
[ ] events collection -> event

*/

type Query<T = firebase.firestore.DocumentData> = firebase.firestore.Query<T>;
type DocumentReference<T = firebase.firestore.DocumentData> = firebase.firestore.DocumentReference<T>;

type QueryDocumentSnapshot<T = firebase.firestore.DocumentData> = firebase.firestore.QueryDocumentSnapshot<T>;
type QuerySnapshot<T = firebase.firestore.DocumentData> = firebase.firestore.QuerySnapshot<T>;

async function migrateEdge(edgeDocSnap: QueryDocumentSnapshot<any>, sourceVertexDoc: DocumentReference) {
  const firestore = firebase.firestore();
  const edgeData = edgeDocSnap.data();
  const { payload = '{}', ref, ...vertexEdgeData } = edgeData;
  const struct = JSON.parse(payload);
  const { artifactID, claimID } = struct;
  const targetVertexID = artifactID || claimID;
  if (targetVertexID) {
    const vertexEdgeDoc = sourceVertexDoc.collection('edge').doc(edgeDocSnap.id);

    // create the target vertex, but just create the backref doc; we'll migrate the artifact later
    const vertexTargetDoc = firestore.collection('vertex').doc(targetVertexID);
    const vertexBackrefDoc = vertexTargetDoc.collection('backref').doc();

    await vertexEdgeDoc.set({
      ...vertexEdgeData,
      v: '3',
      payload: JSON.stringify({
        vertexID: targetVertexID,
        backrefPath: vertexBackrefDoc.path,
      }),
    });
    await vertexBackrefDoc.set({
      ...vertexEdgeData,
      v: '3',
      payload: JSON.stringify({
        vertexID: sourceVertexDoc.id,
        edgePath: vertexEdgeDoc.path,
      }),
    });
    await edgeDocSnap.ref.set({ v: '3' }, { merge: true });
  }
}

async function migrateEdges(edgeQuery: Query<any>, sourceVertexDoc: DocumentReference) {
  const edgeDocQuerySnapshot = await edgeQuery.get();
  if (edgeDocQuerySnapshot.docs.length === 0) return;

  await Promise.all(
    edgeDocQuerySnapshot.docs.map(async (edgeDocSnap) => {
      await migrateEdge(edgeDocSnap, sourceVertexDoc);
    }),
  );

  const lastDoc = edgeDocQuerySnapshot.docs[edgeDocQuerySnapshot.docs.length - 1];
  await migrateEdges(edgeQuery.startAfter(lastDoc), sourceVertexDoc);
}

async function migrateSubcollection(docSnap: QueryDocumentSnapshot, vertexDoc: DocumentReference, collName: string) {
  const collData = docSnap.data();
  const vertexSubcollectionDoc = vertexDoc.collection(collName).doc(docSnap.id);
  await vertexSubcollectionDoc.set({ ...collData, v: '3' });
  await docSnap.ref.set({ v: '3' }, { merge: true });
}

async function migrateSubcollections(query: Query, vertexDoc: DocumentReference, collName: string) {
  const docQuerySnapshot = await query.get();
  if (docQuerySnapshot.docs.length === 0) return;

  await Promise.all(
    docQuerySnapshot.docs.map(async (shareDocSnap) => {
      await migrateSubcollection(shareDocSnap, vertexDoc, collName);
    }),
  );

  const lastDoc = docQuerySnapshot.docs[docQuerySnapshot.docs.length - 1];
  await migrateSubcollections(query.startAfter(lastDoc), vertexDoc, collName);
}

async function migrateToVertex(docRef: DocumentReference<any> | DocumentReference<any>) {
  const firestore = firebase.firestore();
  const docSnap = await docRef.get();
  const vertexID = docRef.id;
  const docType = docRef.parent.id; // artifact or claim
  const docData = docSnap.data();
  if (!docData) return;
  const { namespace, questVisitCache, visitedQuestIds, parentArtifactID, ...vertexData } = docData;

  const edgeSubcollectionName = docType === 'claim' ? 'claimPart' : 'edge';
  const propertySubcollectionName = docType === 'claim' ? 'property' : 'artifactPart';

  const edgeQuery = docRef
    .collection(edgeSubcollectionName)
    .where('status', '==', 'active')
    .where('v', '==', '2') as Query<any>;

  const propertyQuery = docRef
    .collection(propertySubcollectionName)
    .where('status', '==', 'active')
    .where('v', '==', '2') as Query<any>;

  const sharesQuery = docRef.collection('shares').where('status', '==', 'active').where('v', '==', '2') as Query<any>;

  const eventQuery = docRef.collection('event').where('status', '==', 'active').where('v', '==', '2') as Query<any>;

  const vertexDoc = firestore.collection('vertex').doc(vertexID);

  await migrateEdges(edgeQuery, vertexDoc);
  await migrateSubcollections(propertyQuery, vertexDoc, 'property');
  await migrateSubcollections(sharesQuery, vertexDoc, 'share');
  // TODO: it seems events will be top-level documents, but I'm just migrating as-is
  await migrateSubcollections(eventQuery, vertexDoc, 'event');
  await docRef.set({ v: '3' }, { merge: true });
  await vertexDoc.set({
    ...vertexData,
    parentVertexID: parentArtifactID,
    v: '3',
  });
}

async function meldBullets(
  vertexTargetDoc: DocumentReference,
  artifactDocSnap: QueryDocumentSnapshot<any>,
  artifactDataToCopy: Partial<any>,
) {
  const firestore = firebase.firestore();
  // rename this to property
  const partQuerySnapshot = (await artifactDocSnap.ref
    .collection('artifactPart')
    .where('userID', '==', globalStore.getCurrentUserID())
    .where('status', '==', 'active')
    .where('v', '==', '2')
    // .where('role', 'array-contains', 'body')
    .get()) as QuerySnapshot<any>;

  const backrefQuerySnapshot = (await artifactDocSnap.ref
    .collection('claimBackref')
    .where('userID', '==', globalStore.getCurrentUserID())
    .where('status', '==', 'active')
    .where('v', '==', '2')
    // .where('role', 'array-contains', 'body')
    .get()) as QuerySnapshot<any>;

  await Promise.all(
    partQuerySnapshot.docs.map(async (part) => {
      const partData = part.data();
      if (partData.role.includes('body')) {
        await Promise.all(
          backrefQuerySnapshot.docs.map(async (backref) => {
            const backrefData = backref.data();
            if (backrefData.role.includes('body')) {
              const { claimID } = JSON.parse(backrefData.payload || '{}');
              if (claimID) {
                const claimDoc = firestore.collection('claim').doc(claimID) as DocumentReference<any>;
                const claimData = (await claimDoc.get()).data() || ({} as Partial<any>);
                const { namespace, ...claimDataToCopy } = claimData;

                // copy source claim data to the new vertex
                const vertexSourceDoc = firestore.collection('vertex').doc(claimID);
                await vertexSourceDoc.set({ ...claimDataToCopy, v: '3' });

                // we don't update the claim to v3 because the claim migration will do that for us

                // copy target artifact data to the new vertex
                await vertexTargetDoc.set({ ...artifactDataToCopy, v: '3' });

                // create a new property on the source doc
                const propertyDoc = vertexSourceDoc.collection('property').doc() as DocumentReference<any>;
                await propertyDoc.set({ ...partData, v: '3' });
              }
            }
            await backref.ref.set({ v: '3' }, { merge: true });
          }),
        );
      }
      await part.ref.set({ v: '3' }, { merge: true });
    }),
  );
  await artifactDocSnap.ref.set({ v: '3' }, { merge: true });
}

async function migrateArtifact(artifactDocSnap: QueryDocumentSnapshot<any>) {
  const firestore = firebase.firestore();
  const artifactData = artifactDocSnap.data();
  const { questVisitCache, visitedQuestIds, namespace, parentArtifactID, ...artifactDataToCopy } = artifactData;
  const vertexTargetDoc = firestore.collection('vertex').doc(artifactDocSnap.id);
  if (artifactData.kind !== 'text') {
    // simply update the v
    await artifactDocSnap.ref.set({ v: '3' }, { merge: true });
    await vertexTargetDoc.set({
      ...artifactDataToCopy,
      v: '3',
      status: 'active',
    });
    await migrateToVertex(artifactDocSnap.ref);
  } else {
    await meldBullets(vertexTargetDoc, artifactDocSnap, artifactDataToCopy);
  }
}

async function migrateArtifacts(artifactQuery: Query<any>) {
  const artifactDocQuerySnapshot = await artifactQuery.get();
  if (artifactDocQuerySnapshot.docs.length === 0) return;

  await Promise.all(
    artifactDocQuerySnapshot.docs.map(async (artifactDocSnap) => {
      await migrateArtifact(artifactDocSnap);
    }),
  );

  const lastDoc = artifactDocQuerySnapshot.docs[artifactDocQuerySnapshot.docs.length - 1];
  await migrateArtifacts(artifactQuery.startAfter(lastDoc));
}

async function migrateClaim(claimDocSnap: QueryDocumentSnapshot<any>) {
  const firestore = firebase.firestore();
  const claimData = claimDocSnap.data();
  const { namespace, ...claimDataToCopy } = claimData;
  const vertexTargetDoc = firestore.collection('vertex').doc(claimDocSnap.id);
  // simply update the v
  await claimDocSnap.ref.set({ v: '3' }, { merge: true });
  await vertexTargetDoc.set({ ...claimDataToCopy, v: '3', status: 'active' });
  await migrateToVertex(claimDocSnap.ref);
}

async function migrateClaims(claimQuery: Query<any>) {
  const claimDocQuerySnapshot = await claimQuery.get();
  if (claimDocQuerySnapshot.docs.length === 0) return;

  await Promise.all(
    claimDocQuerySnapshot.docs.map(async (claimDocSnap) => {
      await migrateClaim(claimDocSnap);
    }),
  );

  const lastDoc = claimDocQuerySnapshot.docs[claimDocQuerySnapshot.docs.length - 1];
  await migrateClaims(claimQuery.startAfter(lastDoc));
}

export async function migrate2to3() {
  const firestore = firebase.firestore();
  const userID = globalStore.getCurrentUserID();
  if (!userID) return;

  // migrate artifacts first, to do the bullet migration, which will update some claims, but crucially, NOT update them to v3
  const artifactDocQuerySnapshot = firestore
    .collection('artifact')
    .where('userID', '==', userID)
    .where('v', '==', '2')
    .where('status', '==', 'active')
    .limit(100) as Query<any>;
  await migrateArtifacts(artifactDocQuerySnapshot);

  // get the stragglers
  const claimDocQuerySnapshot = firestore
    .collection('claim')
    .where('userID', '==', userID)
    .where('v', '==', '2')
    .where('status', '==', 'active')
    .limit(100) as Query<any>;
  await migrateClaims(claimDocQuerySnapshot);
}
