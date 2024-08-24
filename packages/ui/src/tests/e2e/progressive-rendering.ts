import * as utils from '../utility/test-utils';
import * as VM from '../../viewmodel';
import assert from 'assert';
import { globalAuthService } from '../../service';

// https://edvo.atlassian.net/browse/PLM-1930
// Ensures progressive rendering works

export async function progressiveRendering() {
  // SETUP
  const { root, topicSpace } = await utils.setup();
  const authService = globalAuthService();
  const currentUser = authService.currentUserVertexObs.value;
  assert.ok(currentUser);

  // Enable progressive rendering if it is not
  const progressiveRenderingEnabled = await currentUser
    .getFlagPropertyObs('progressive-rendering-enabled')
    .mapObs((v) => !!v)
    .get();

  if (!progressiveRenderingEnabled) {
    await authService.currentUserVertexObs.value?.toggleFlagProperty('progressive-rendering-enabled', null);
  }

  const member = await utils.createMember('normal', topicSpace);

  const vps = topicSpace.viewportState;

  await vps.setAndAwaitChange(async () => vps.set(new VM.ViewportState({ ...vps.value, planeScale: 0.19 })));

  assert.equal(member.body.value, null, 'Expected member body to derender at low zoom');

  // disable prog rendering
  await authService.currentUserVertexObs.value?.toggleFlagProperty('progressive-rendering-enabled', null);

  assert.ok(member.body.value, 'Expected member body to render at low zoom if progressive rendering is disabled');
}
