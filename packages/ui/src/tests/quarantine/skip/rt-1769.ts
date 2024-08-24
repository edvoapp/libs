import assert from 'assert';
import { globalContext } from '../../../viewmodel';
import * as VM from '../../../viewmodel';
import { click, createMember, keyDown, keyPress, mouseDown } from '../utility/test-utils';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';
import { getContrastColor } from '../../../lib/color';
import { DEFAULT_CARD_DIMS, DEFAULT_PORTAL_DIMS, DEFAULT_WEBCARD_DIMS } from '../../../service';
import { trxWrap } from '@edvoapp/common';

// Regression test for PLM-1769 - Creating items via double click doesn't reflect last selected item
// https://edvo.atlassian.net/browse/PLM-1769
export async function RT1769() {
  const root = await initRoot({ topicName: 'test', navToNewTopic: true });
  const ts = getTopicSpace(root);
  const ctx = globalContext();
  const focusState = ctx.focusState;

  const authService = ctx.authService;
  const currentUser = authService.currentUserVertexObs.value!;

  // Enable double-click to create if it is not
  const doubleClickToCreateEnabled = await currentUser
    .getFlagPropertyObs('double-click-to-create-enabled')
    .mapObs((v) => !!v)
    .get();

  if (!doubleClickToCreateEnabled) {
    await currentUser.toggleFlagProperty('double-click-to-create-enabled', null);
  }

  // 1. Create a sticky

  const member = await createMember('stickynote', ts, {
    x_coordinate: 0,
    y_coordinate: 0,
    width: 450,
    height: 500,
  });

  // Change sticky size and color
  const color = '#EDE9FE';
  const textColor = getContrastColor(color);
  await member.vertex.setJsonPropValues(
    'appearance',
    {
      color,
      textColor,
    },
    null,
  );

  // Select sticky
  await focusState.setFocus(member, {});

  // Double click in space
  mouseDown({ node: ts, relativeCoords: { x: 500, y: 500 }, detail: 2 });
  const members = await ts.members.awaitItemsInList(2);
  const member2 = members.find((m) => !m.equals(member));
  assert.ok(member2);

  // A default sticky is created -- test fails here on main 802c15bf9faca515e7d401ff6f81b9bd167b1796
  const appearance = await member2.appearance.get();
  const meta = await member2.meta.get();
  assert.equal(appearance.color, color);
  assert.equal(appearance.textColor, textColor);
  assert.equal(meta.width, 450);
  assert.equal(meta.height, 500);
}

// Regression test for PLM-1769, part 2 - Creating items via toolbar should never copy last-selected item
export async function RT1769_2() {
  const root = await initRoot({ topicName: 'test', navToNewTopic: true });
  const ts = getTopicSpace(root);
  const ctx = globalContext();
  const focusState = ctx.focusState;

  // 1. Create a sticky
  const member = await createMember('stickynote', ts, {
    x_coordinate: 0,
    y_coordinate: 0,
    width: 450,
    height: 500,
  });

  // Change sticky size and color
  const color = '#EDE9FE';
  const textColor = getContrastColor(color);
  await member.vertex.setJsonPropValues(
    'appearance',
    {
      color,
      textColor,
    },
    null,
  );

  for (const key of ['s', 'n', 'a'] as const) {
    await makeMember(key, ts, member);
  }
}

/*
b: browser
s: sticky
p: portal
n: card (normal)
 */

const makeMember = async (key: 's' | 'n' | 'a', ts: VM.TopicSpace, member: VM.Member) => {
  const ctx = globalContext();
  const focusState = ctx.focusState;
  // select member to "copy" and ensure it isn't "pasted"
  await focusState.setFocus(member, {});
  // select space for purposes of hotkey dispatch
  await focusState.setFocus(ts, {});
  await keyPress(key);

  // Single-click in space
  const members = await ts.members.setAndAwaitChange(async () => {
    await click({ node: ts, relativeCoords: { x: 500, y: 500 } });
  });
  const newMember = members.find((m) => !m.equals(member));
  assert.ok(newMember);

  const expectedColor = key === 's' ? '#E0E31A' : '#FFF';
  const expectedDims = (() => {
    switch (key) {
      case 's':
      case 'n':
        return DEFAULT_CARD_DIMS;
      case 'a':
        return DEFAULT_PORTAL_DIMS;
      // case 'b':
      //   return DEFAULT_WEBCARD_DIMS;
    }
  })();

  // A default member should be created -- test fails here on main e87e22ecba4450a9b436342a6be57932018cd8c7
  const appearance = await newMember.appearance.get();
  const meta = await newMember.meta.get();
  assert.equal(appearance.color, expectedColor);
  assert.equal(meta.width, expectedDims.width);
  assert.equal(meta.height, expectedDims.height);

  // delete the member to make room for the next one
  await ts.members.setAndAwaitChange(async () => {
    await trxWrap(async (trx) => newMember.backref.archive(trx));
  });
};
