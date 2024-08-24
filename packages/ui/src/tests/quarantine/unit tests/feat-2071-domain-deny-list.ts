import assert from 'assert';
import { Model, trxWrap } from '@edvoapp/common';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';
import { addTopicMemberFromUrl } from '../../../behaviors';
import * as VM from '../../../viewmodel';

// Feature test for PLM-2071 - Ensure that certain URLs are blacklisted from rendering their iframes
// https://edvo.atlassian.net/browse/PLM-2071

const sampleDenyListUrls = [
  'https://calendar.google.com/calendar/u/0/r/week',
  'https://mail.google.com/mail/u/0/#inbox',
  'https://web.whatsapp.com/',
  'https://www.reddit.com/r/CodingHelp/comments/zdu0lg/help_with_browserify/',
  'https://www.instagram.com/womenontopp/?next=https%3A%2F%2Fwww.instagram.com%2Fchocnilla%2F%3Fhl%3Den',
  'https://onedrive.live.com/edit.aspx?resid=7805799A031160B9!1145&cid=7805799a031160b9&CT=1712101596208&OR=ItemsView',
  'https://console.firebase.google.com/',
  'https://www.facebook.com/groups/116719521859752/',
  'https://framer.com/projects/Edvo-v-2-0--JS6JDf6t3B6b13X62vwu',
];

const sampleAllowListUrls = [
  'https://www.google.com/search?q=search&oq=search',
  'https://about.instagram.com/blog/tips-and-tricks/instagram-story-tips-tricks',
  'https://www.microsoft.com/en-us/microsoft-365/onedrive/online-cloud-storage',
];

export async function FEAT2071() {
  const root = await initRoot({ topicName: 'test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);

  await trxWrap(async (trx) =>
    Promise.all(
      sampleDenyListUrls.map(async (u, idx) => {
        let x = 10 * idx;
        let y = 10 * idx;
        await addTopicMemberFromUrl(trx, topicSpace.vertex, new URL(u), {
          x,
          y,
        });
      }),
    ),
  );

  let members = await topicSpace.members.awaitCondition((mems) => mems.length === sampleDenyListUrls.length && mems);
  assert.ok(members);
  await topicSpace.recursiveLoad();

  // ensure that absolutely 0 iframes render after load
  // need to namespace by app because we may have 3rd party services that inject iframes elsewhere
  const app = document.getElementById('app');
  assert.ok(app);
  let iframes = app.getElementsByTagName('iframe');
  assert.ok(
    iframes.length === 0,
    `Expected zero iframes to render when rendering a collection of blacklisted urls, but ${iframes.length} rendered`,
  );

  const context = VM.globalContext();

  await trxWrap(async (trx) =>
    Promise.all(
      sampleAllowListUrls.map(async (u, idx) => {
        let x = 200 + (sampleDenyListUrls.length + idx) * 10;
        let y = 200 + (sampleDenyListUrls.length + idx) * 10;
        await addTopicMemberFromUrl(trx, topicSpace.vertex, new URL(u), {
          x,
          y,
        });
      }),
    ),
  );

  // pretend extension is not injected, PLM-2077
  context.extBridge?.extensionStatus.set('NOT_INJECTED');
  members = await topicSpace.members.awaitCondition(
    (mems) => mems.length === sampleDenyListUrls.length + sampleAllowListUrls.length && mems,
  );
  assert.ok(members);
  await topicSpace.recursiveLoad();

  iframes = app.getElementsByTagName('iframe');
  assert.equal(
    iframes.length,
    0,
    `Expected URLs on the allow-list not to render if the extension is not injected, but ${iframes.length} rendered`,
  );

  // pretend extension is injected
  context.extBridge?.extensionStatus.set('INJECTED');
  await topicSpace.recursiveLoad();

  // ensure that allow-list iframes render after load
  iframes = app.getElementsByTagName('iframe');
  assert.equal(
    iframes.length,
    sampleAllowListUrls.length,
    `Expected URLs on the allow-list to each render an iframe, but only ${iframes.length} rendered`,
  );
}
