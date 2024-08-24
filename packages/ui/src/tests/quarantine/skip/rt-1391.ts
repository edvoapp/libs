import { Model, sleep, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import assert from 'assert';
import * as VM from '../../../viewmodel';
import { MemberAppearance } from '../../../behaviors';
import { createTopic, createUser } from '../utility/test-utils';
import { Guard } from '@edvoapp/util';

export async function RT1391() {
  const authService = window.authService;
  const { userID: topicCreatorID, email: topicCreatorEmail } = await createUser('creator');
  console.debug('Created topic creator vertex:', topicCreatorID);

  const vertex = await createTopic('test share topic', true);
  let rootNode = (await window.edvoui.VM.globalContext().awaitRootNode) as VM.AppDesktop;
  Guard.unsafe(rootNode);
  console.debug('Created test share topic', vertex.id);
  const topicURL = `/topic/${vertex.id}`;

  const { userID: userToShareWithID, email: userToShareWithEmail } = await createUser('share-with');

  console.debug('Created user to share with vertex', userToShareWithID);

  await authService.signOut();
  await authService.currentUserVertexObs.awaitUndefined();
  await authService.signIn(topicCreatorEmail, 'password');
  await authService.currentUserVertexObs.awaitDefined();
  route(topicURL);

  rootNode = (await window.edvoui.VM.globalContext().awaitRootNode) as VM.AppDesktop;
  let g = Guard.unsafe(rootNode);
  await rootNode.load();

  let space = rootNode.findChild((n) => n instanceof VM.TopicSpace && n);
  if (!space) throw new Error('Topic Space not found');
  const dropMenu = space.shareTray.shareDropmenu;
  dropMenu.expanded.set(true);
  const menu = (await dropMenu.modal.awaitDefined()) as unknown as {
    menu: VM.ShareMenu;
  };
  const userSelectionBox = menu.menu.list.userSelectionBox;
  userSelectionBox.users.insert(userToShareWithEmail);

  // note: this should probably be more like....
  /*

  const userSelectionBox =
    space.shareTray.shareDropmenu.modal.menu.list.userSelectionBox;
  userSelectionBox.users.insert(
    Model.Vertex.getById({ id: userToShareWithID }),
  );
  await sleep(1);
  await userSelectionBox.sendInvitations('write');

  but this won't work until we figure out how to get our rust server to run in the test env
   */

  await trxWrap(async (trx) => {
    Model.Priv.Share.create({
      trx,
      vertex,
      data: {
        shareType: 'allow',
        targetUserID: userToShareWithID,
        shareCategory: 'write',
      },
    });
    Model.Priv.Share.create({
      trx,
      vertex,
      data: {
        shareType: 'allow',
        targetUserID: topicCreatorID,
        shareCategory: 'write',
      },
    });
  });

  console.debug('Created share state');

  await authService.signOut();
  await authService.currentUserVertexObs.awaitUndefined();
  await authService.signIn(userToShareWithEmail, 'password');
  await authService.currentUserVertexObs.awaitDefined();

  route(topicURL);

  rootNode = (await window.edvoui.VM.globalContext().awaitRootNode) as VM.AppDesktop;
  // g.release();
  g = Guard.unsafe(rootNode);
  await rootNode.load();
  space = rootNode.findChild((n) => n instanceof VM.TopicSpace && n);
  if (!space) throw new Error('Topic Space not found');
  const privs = space.projectedPrivileges();
  console.debug('Got projected privs from space', privs);

  const { edge } = await trxWrap(async (trx) => {
    const sticky = Model.Vertex.create({ trx });
    sticky.createProperty({
      trx,
      role: ['body'],
      contentType: 'text/plain',
      initialString: '',
    });
    await sticky.setJsonPropValues<MemberAppearance>(
      'appearance',
      {
        color: '#fff',
        textColor: '#000',
        type: 'stickynote',
      },
      trx,
    );
    const stickyEdge = sticky.createEdge({
      trx,
      role: ['member-of'],
      target: vertex,
      seq: 1,
      meta: { x_coordinate: 0, y_coordinate: 0 },
      privs,
    });
    return { edge: stickyEdge, vertex: sticky };
  });
  console.debug('created sticky', edge);
  const priv = await edge.privs.awaitDefined();
  console.debug('Got privs for edge', priv);
  assert.deepEqual(priv.recipientID, [userToShareWithID, topicCreatorID]);
  g.release();
  return true;
}
