import * as utils from '../utility/test-utils';
import * as VM from '../../../viewmodel';
import { globalContext } from '../../../viewmodel';
import assert from 'assert';
import { addTopicMemberFromUrl, upsertVertex } from '../../../behaviors';
import { trxWrap } from '@edvoapp/common';
import * as url from 'url';

// https://edvo.atlassian.net/browse/PLM-1900
// Verifies that a URL can be pasted without any errors

export async function RT1900() {
  await utils.signIn('rasheed@edvo.com', 'password');
  await utils.createTopic('Test', true);

  const root = await utils.getRoot();
  await root.recursiveLoad();
  const tsPage = root.topicSpace.value;
  if (!tsPage) throw new Error('Expected a new space to have been navigated to');

  const topicSpace = tsPage.topicSpace;
  await topicSpace.waitForDomElement(); // wait for it to render

  const url = 'https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?quickFilter=28&selectedIssue=PLM-1897';

  // Throws an error here on b91a9feb3d54b40030f9db2b9088e64fb7ae910b
  await trxWrap(async (trx) => {
    await addTopicMemberFromUrl(trx, topicSpace.vertex, new URL(url));
  });

  return true;
}
