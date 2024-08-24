import * as utils from '../utility/test-utils';
import { route } from 'preact-router';
import assert from 'assert';
import { UrlPaste, addTopicMemberFromUrl } from '../../behaviors';
import { DEFAULT_WEBCARD_DIMS } from '../..';
import { ViewportState } from '../../viewmodel';

const EPSILON = 1;

// RT for PLM-1546 - Fix ContentCards in resource spaces
// https://edvo.atlassian.net/browse/PLM-1546
// Verified failing against b3b747894
export async function RT1546() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  // paste a URL
  {
    const url = UrlPaste.urlTidy('https://en.wikipedia.org/wiki/Potato');
    await addTopicMemberFromUrl(null, topicSpace.vertex, url, {
      x: 150,
      y: 150,
    });
  }

  // go to the resource page of the web card
  {
    const webcard = topicSpace.members.firstChild();
    assert.ok(webcard, 'Expected a web card to be created');
    const resourceUrl = `/topic/${webcard.vertex.id}`;
    route(resourceUrl);
    await utils.awaitUrlChange(resourceUrl);
  }

  const resourceSpace = await utils.getTopicSpace(root);

  // check that the empty state page is not shown
  {
    const emptyStatePage = document.querySelector('[data-test="empty-state-page"]');
    assert.ok(!emptyStatePage, 'Expected the empty state page not to be shown');
  }

  // check the size of the card to be 1280x720 by default
  const contentCard = await resourceSpace.contentCard.awaitDefined();

  const { width: defaultWidth, height: defaultHeight } = DEFAULT_WEBCARD_DIMS;
  const contentCardRectObs = contentCard.clientRectObs;
  let scale = contentCardRectObs.value.innerScale;

  {
    const { innerWidth, innerHeight } = contentCardRectObs.value;
    assert.ok(
      innerWidth === defaultWidth && innerHeight === defaultHeight,
      `Expected the content card to be 1280x720 but it is ${innerWidth}x${innerHeight}`,
    );
  }

  // check that the size of the card does not change when zooming in and out
  const viewportState = resourceSpace.viewportState;

  // zoom out and check the size of the card
  {
    await viewportState.setAndAwaitChange(() => {
      void utils.pinch(resourceSpace, { dir: 'in', center: true });
    });
    const { innerWidth, innerHeight, innerScale } = contentCardRectObs.value;
    assert.ok(
      Math.abs(innerWidth - defaultWidth) < EPSILON &&
        Math.abs(innerHeight - defaultHeight) < EPSILON &&
        scale !== innerScale,
      'Expected the content card to be 1280x720 after zooming out',
    );
    scale = innerScale; // update scale to compare with the next zoom
  }

  // zoom in and check the size of the card
  {
    await viewportState.setAndAwaitChange(() => {
      void utils.pinch(resourceSpace, { dir: 'out', center: true });
    });
    const { innerWidth, innerHeight, innerScale } = contentCardRectObs.value;
    assert.ok(
      Math.abs(innerWidth - defaultWidth) < EPSILON &&
        Math.abs(innerHeight - defaultHeight) < EPSILON &&
        scale !== innerScale,
      'Expected the content card to be 1280x720 after zooming in',
    );
  }

  // set the inner scale to 1
  {
    await contentCardRectObs.setAndAwaitChange(async () =>
      viewportState.set(new ViewportState({ ...viewportState.value, planeScale: 1 })),
    );
    const { innerScale } = contentCardRectObs.value;
    assert.ok(innerScale === 1, 'Expected the plane scale to be 1');
  }

  // check that the content card can be resized
  {
    const rect = contentCardRectObs.value;
    const delta = 10;
    const grabPos = { x: rect.x + 1, y: rect.y + 1 };
    const releasePos = { x: rect.x + delta, y: rect.y + delta };

    const transformedRect = rect.transform(releasePos.x, releasePos.y, rect.width - delta, rect.height - delta);

    await contentCard.clientRectObs.setAndAwaitChange(async () => {
      await utils.dragDrop({
        node: contentCard,
        clientCoords: grabPos,
        destCoords: releasePos,
      });
    });

    const newRect = contentCardRectObs.value;
    assert.ok(newRect.compare(transformedRect, 1), 'Expected the card to be resized');
  }

  // check that the action menu appears when clicking on the card
  {
    const { x, y } = contentCardRectObs.value;
    await utils.click({ node: root, clientCoords: { x: x + 100, y: y + 100 } });
    await contentCard.actionMenu.awaitCondition((actionMenu) => !!actionMenu);
    const actionMenu = document.querySelector('[data-test="action-menu"]');
    assert.ok(actionMenu, 'Expected the action menu to be shown');
  }

  return true;
}
