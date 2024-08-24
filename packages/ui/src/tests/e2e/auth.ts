import * as utils from '../utility/test-utils';
import assert from 'assert';

export async function createUser() {
  const authService = window.authService;
  const { fullName } = await utils.createUser();

  const currentUser = authService.currentUserVertexObs.value!;
  assert.ok(currentUser, 'Failed to retrieve current user from auth service');
  const fname = await currentUser.getPlainTextPropValue('full-name');
  assert.strictEqual(
    fname,
    fullName,
    `Expected 'full-name' property of currentUser to be ${fullName} but received ${fname}`,
  );
  const [v] = await currentUser
    .filterBackrefs({ role: ['welcome-space'] })
    .mapObs((x) => x.target)
    .toArray();
  assert.ok(v, 'Expected welcome space to have been created and linked to user');
  assert.equal(
    window.location.pathname,
    `/welcome`,
    `Expected user to be navigated to welcome page, but was navigated to ${window.location.pathname}`,
  );
}
