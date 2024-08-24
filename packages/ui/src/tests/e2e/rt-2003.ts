import * as utils from '../utility/test-utils';
import assert from 'assert';

// click on a web card doesn't break
export async function RT2003() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();
  const focusState = ctx.eventNav.focusState;

  // TEST
  // add a web card into the space
  const webCard = await utils.createMember('browser', topicSpace);

  // click on the web card
  await utils.click({ node: webCard });

  // check if the empty web card content, empty browser, is focused
  const body = await webCard.body.awaitDefined();
  const emptyBrowser = await body.emptyBrowser.awaitDefined();
  assert.equal(focusState.currentFocus, emptyBrowser, 'EmptyBrowser must be focused');

  // update the url of the web card
  const edvoUrl = 'https://edvo.com/';
  body.updateUrl(edvoUrl);

  // check if the url is updated
  const resultUrl = await body.content.property.mapObs((p) => p?.text).awaitDefined();
  assert.equal(resultUrl, edvoUrl, `The url is not the expected: ${resultUrl}`);

  // click on the web card again and assert that the non-empty web card body content is focused
  await utils.click({ node: webCard });
  assert.equal(focusState.currentFocus, body.content, 'Member body must be focused');
  return true;
}
