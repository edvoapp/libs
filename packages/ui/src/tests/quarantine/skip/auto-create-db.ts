import assert from 'assert';
import { createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { createTopic } from '../utility/test-utils';
import { MemberAppearance, MemberAppearanceType } from '../../../behaviors';
import { Model, trxWrap, trxWrapSync } from '@edvoapp/common';
import { TopicSpace } from '../../../viewmodel';

type MemberAppearanceCounts = Partial<Record<MemberAppearanceType, number>>;

type ContentType = {
  contentType: 'text/plain' | 'text/x-uri';
};

export async function AutoCreateTestDB(sizeOrCounts: number | MemberAppearanceCounts) {
  const root = await initRoot();
  await createTopic('Test DB', true);
  const topicspace = getTopicSpace(root);

  let i = 0;
  const MAX_IN_ROW = 10;
  const GAP_HORIZONTAL = 10;
  const GAP_VERTICAL = 50;
  const WH = 300;
  const PLACEHOLDER_TEXT =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  const PLACEHOLDER_URL = 'https://en.wikipedia.org/wiki/Philosophy';

  const memberAppearanceValues: MemberAppearanceType[] = [
    'subspace',
    'stickynote',
    'normal',
    'clean',
    'browser',
    'list',
  ];

  let totalSize;
  let appearanceCounts: MemberAppearanceCounts;

  if (typeof sizeOrCounts === 'number') {
    // Default Cycling Case
    totalSize = sizeOrCounts;
    appearanceCounts = memberAppearanceValues.reduce((acc, type) => {
      acc[type] = Math.ceil(sizeOrCounts / memberAppearanceValues.length);
      return acc;
    }, {} as MemberAppearanceCounts);
  } else {
    // Custom Counts Case
    appearanceCounts = sizeOrCounts;
    if (!sizeOrCounts) {
      throw new Error('sizeOrCounts is null or undefined');
    }
    totalSize = Object.values(sizeOrCounts).reduce((sum, count) => sum + (count || 0), 0);
  }

  let appearanceTypeIndex = 0;
  let countForCurrentType = appearanceCounts[memberAppearanceValues[appearanceTypeIndex]] || 0;

  while (i < totalSize) {
    const x = (i % MAX_IN_ROW) * (WH + GAP_HORIZONTAL);
    const y = Math.floor(i / MAX_IN_ROW) * (WH + GAP_VERTICAL);
    const type = memberAppearanceValues[appearanceTypeIndex];

    const dummyMember = await createMember(x, y, WH, WH, type, topicspace, `Test member ${i + 1}`);

    if (type === 'normal' || type === 'clean') {
      const itemRole = [`category-item`];
      trxWrapSync((trx) => {
        for (let j = 0; j < 5; j++) {
          const firstVertex = Model.Vertex.create({ trx });
          firstVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: PLACEHOLDER_TEXT,
          });

          firstVertex.createEdge({
            trx,
            target: dummyMember.vertex,
            role: itemRole,
            seq: 1,
            meta: {},
          });

          // Create another vertex with a target to the just made vertex
          const secondVertex = Model.Vertex.create({ trx });
          secondVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: PLACEHOLDER_TEXT,
          });
          secondVertex.createEdge({
            trx,
            target: firstVertex,
            role: itemRole,
            seq: 2,
            meta: {},
          });
        }
      });
    }
    if (type === 'subspace') {
      const memberBody = await dummyMember.body.awaitDefined();
      const portalSpace = await memberBody.portal.awaitDefined();
      if (!(portalSpace instanceof TopicSpace)) throw new Error('expected a portal to be rendered');
      const portalMember = await createMember(x, y, WH, WH, 'normal', portalSpace, `Portal test member ${i + 1}`);
      const itemRole = [`category-item`];
      trxWrapSync((trx) => {
        for (let j = 0; j < 5; j++) {
          const firstVertex = Model.Vertex.create({ trx });
          firstVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: PLACEHOLDER_TEXT,
          });

          firstVertex.createEdge({
            trx,
            target: portalMember.vertex,
            role: itemRole,
            seq: 1,
            meta: {},
          });

          // Create another vertex with a target to the just made vertex
          const secondVertex = Model.Vertex.create({ trx });
          secondVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: PLACEHOLDER_TEXT,
          });
          secondVertex.createEdge({
            trx,
            target: firstVertex,
            role: itemRole,
            seq: 2,
            meta: {},
          });
        }
      });
    }
    if (type === 'list') {
      dummyMember.vertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'subspace' }, null);
      const memberBody = await dummyMember.body.awaitDefined();
      const portalSpace = await memberBody.portal.awaitDefined();
      if (!(portalSpace instanceof TopicSpace)) throw new Error('expected a portal to be rendered');
      const portalMember = await createMember(x, y, WH, WH, 'normal', portalSpace, `Portal test member ${i + 1}`);
      const itemRole = [`category-item`];
      trxWrapSync((trx) => {
        for (let j = 0; j < 5; j++) {
          const firstVertex = Model.Vertex.create({ trx });
          firstVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: PLACEHOLDER_TEXT,
          });

          firstVertex.createEdge({
            trx,
            target: portalMember.vertex,
            role: itemRole,
            seq: 1,
            meta: {},
          });

          // Create another vertex with a target to the just made vertex
          const secondVertex = Model.Vertex.create({ trx });
          secondVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: PLACEHOLDER_TEXT,
          });
          secondVertex.createEdge({
            trx,
            target: firstVertex,
            role: itemRole,
            seq: 2,
            meta: {},
          });
        }
      });
      dummyMember.vertex.setJsonPropValues<MemberAppearance>('appearance', { type: 'list' }, null);
    }
    if (type === 'browser') {
      trxWrapSync((trx) => {
        dummyMember.vertex.createProperty({
          trx,
          role: ['body'],
          contentType: 'text/x-uri',
          initialString: PLACEHOLDER_URL,
        });
      });
    }
    if (type === 'stickynote') {
      trxWrapSync((trx) => {
        dummyMember.vertex.createProperty({
          trx,
          role: ['body'],
          contentType: 'text/plain',
          initialString: PLACEHOLDER_TEXT,
        });
      });
    }

    countForCurrentType--;
    if (countForCurrentType <= 0) {
      appearanceTypeIndex = (appearanceTypeIndex + 1) % memberAppearanceValues.length;
      countForCurrentType = appearanceCounts[memberAppearanceValues[appearanceTypeIndex]] || 0;
    }

    i++;
  }

  return true;
}
