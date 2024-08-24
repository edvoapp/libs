import * as VM from '../../../viewmodel';
import { createTopic, createUser, pinch, signIn } from '../utility/test-utils';
import assert from 'assert';
import * as utils from '../utility/test-utils';

export async function RT1409() {
  const { root, topicSpace } = await utils.setup();

  const meta_a = {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 500,
    height: 500,
  };

  // just for the sake of visually verifying that zoom is happening
  await utils.createMember('stickynote', topicSpace, meta_a);

  const vps = topicSpace.viewportState;
  const scale0 = topicSpace.planeScale;

  // pinch out, means zoom in
  await vps.setAndAwaitChange(async () => {
    await pinch(topicSpace, { dir: 'out', center: true });
  });
  const scale1 = topicSpace.planeScale;
  assert.ok(scale1 > scale0, 'Expected scale to increase after pinching out');

  // pinch in, means zoom out
  await vps.setAndAwaitChange(async () => {
    await pinch(topicSpace, { dir: 'in', center: true });
  });
  const scale2 = topicSpace.planeScale;
  assert.ok(scale2 < scale1, 'Expected scale to decrease after pinching in');

  const newVps1 = await vps.setAndAwaitChange(() => {
    vps.set(new VM.ViewportState({ ...vps.value, planeScale: 0.02 }));
  });

  // this should not trigger any listeners on vps
  await pinch(topicSpace, { dir: 'in', center: true });

  assert.equal(
    newVps1,
    topicSpace.viewportState.value,
    'Expected the viewport state not to change after zooming out at 0.02',
  );

  return true;
}
