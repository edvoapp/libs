import assert from 'assert';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';
import * as helpers from '../utility/helpers-temp';
import { Model, sleep, trxWrap, trxWrapSync } from '@edvoapp/common';
import { click, wheel } from '../utility/test-utils';
import { expect } from '@playwright/test';
import { TSPage, globalContext } from '../../../viewmodel';
import * as utils from '../utility/test-utils';
import { route } from 'preact-router';

// Regression test for PLM-1994 - Tool call viewer should be opened when user clicks on a tool call option button in a chat message
// https://edvo.atlassian.net/browse/PLM-1994?atlOrigin=eyJpIjoiMWU4OTljZDE0ZDgxNDc3NjkxOTdjNGJkNmI1NGY5ZDIiLCJwIjoiaiJ9

export async function FEAT1994() {
  let root = await initRoot({ topicName: 'test', navToNewTopic: true });
  let ts = getTopicSpace(root);
  const eventNav = ts.context.eventNav;
  const topicURL = `/topic/${ts.vertex.id}`;
  const user = globalContext().authService.currentUserVertexObs.value;
  assert.ok(user, 'User must be defined');

  // 1. Create a new user that will be a participant in the chat.
  const participantUserId = await utils.createUser('chat-participant');
  const participantUser = Model.Vertex.getById({
    id: participantUserId.userID,
  });

  route(topicURL); // navigate past welcome screen
  await sleep(10); // wait for new root
  root = await utils.getRoot();
  await root.recursiveLoad();
  ts = helpers.getTopicSpace(root);

  assert.ok(participantUser, 'Participant user must be defined');
  const spaceVertex = ts.vertex;
  const topisSpacePage = ts.parentNode as TSPage; // get topic space node

  let fixedItems = root.fixedItems; // load fixed items

  // if (root.helpModal.isOpen)
  //   await click({ node: root.helpButton }); // click away on the auto pop up help modal for new users
  // }

  // 2. Create a new conversation with the participant user and the current user.
  trxWrapSync((trx) => {
    participantUser.createEdge({
      trx,
      target: user,
      role: ['participant'],
      meta: {},
    });
    Model.Priv.Share.create({
      trx,
      vertex: participantUser,
      data: {
        shareType: 'allow',
        shareCategory: 'write',
        targetUserID: user.id,
      },
    });

    const conversation = Model.Vertex.create({ trx });

    // link this conversation to this topic space
    conversation.createEdge({
      trx,
      target: spaceVertex,
      role: ['conversation'],
      meta: { expanded: true },
    });

    // create edge to participant user
    conversation.createEdge({
      trx,
      target: participantUser,
      role: ['participant'],
      meta: {},
    });

    // create edge to user
    conversation.createEdge({
      trx,
      target: user,
      role: ['participant'],
      meta: {},
    });
  });

  //3. Create a new tool call message in the chat.
  const spaceChatPanel = await root.chatPanel.activeChat.awaitDefined();
  const spaceChatPanelVertex = spaceChatPanel.vertex;

  trxWrapSync((trx) => {
    const message = Model.Vertex.create({ trx });
    message.createEdge({
      trx,
      target: spaceChatPanelVertex,
      role: ['message'],
      meta: { messageRole: 'user' },
      seq: Date.now(),
    });
    message.createBodyTextProperty({
      trx,
      initialText: 'Test message',
    });
    message.createProperty({
      role: ['tool_call'],
      trx,
      contentType: 'application/json',
    });
  });

  // 4. Click on the tool call viewer button in the chat message.
  const message = spaceChatPanel!.messages.value[0];
  await message.showToolCall.waitForDomElement();
  const toolCallViewerButton = message.showToolCall;

  await click({ node: toolCallViewerButton });

  // 5. Verify that the tool call viewer is opened.
  await fixedItems.awaitItemsInList(1);
  const toolCallViewerPanel = fixedItems.value[0];

  assert.ok(toolCallViewerPanel, 'Tool call viewer must be visible');

  return true;
}
