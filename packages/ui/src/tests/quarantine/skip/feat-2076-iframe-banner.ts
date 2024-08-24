import assert from 'assert';
import { addTopicMemberFromUrl } from '../../../behaviors';
import { trxWrap } from '@edvoapp/common';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';

// https://edvo.atlassian.net/browse/PLM-2076 Verifies that an iframe has a banner

export async function RT2076() {
  const root = await initRoot({ topicName: 'test', navToNewTopic: true });
  let topicSpace = getTopicSpace(root);
  const url = 'https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?quickFilter=28&selectedIssue=PLM-1897';

  await trxWrap(async (trx) => {
    await addTopicMemberFromUrl(trx, topicSpace.vertex, new URL(url));
  });
  await topicSpace.members.awaitItemsInList();
  const iframeWrapper = document.querySelector("[data-pw='iframe-wrapper']");
  assert.ok(iframeWrapper);
  const openInNewTabButton = iframeWrapper.querySelector('a');
  assert.ok(openInNewTabButton);
  assert.equal(openInNewTabButton.href, url);
  assert.equal(openInNewTabButton.target, '_blank');
}
