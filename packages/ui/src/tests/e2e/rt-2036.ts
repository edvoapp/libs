import assert from 'assert';
import { route } from 'preact-router';
import * as utils from '../utility/test-utils';
import { VM } from '../..';

// Regression test for PLM-2036 - Ensure lozenge loads when a topic space is opened
// https://edvo.atlassian.net/browse/PLM-2036
// Failing main commit hash: c1c2b93ade1a5b844b414ab6e8249a0b05148f80

export async function RT2036() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();

  const originalTopicId = topicSpace.vertex.id;
  const eventNav = ctx.eventNav;

  // Creates a sticky note
  await utils.createMember('stickynote', topicSpace, { x_coordinate: 500, y_coordinate: 500 });

  {
    const [stickynote] = await topicSpace.members.awaitItemsInList(1);
    const stickyBody = await stickynote.body.awaitDefined();
    const stickyTextfield = await stickyBody.content.textField.awaitDefined();

    // create another space to embed in the above sticky textfield
    const embededSpace = await utils.createTopic('Embeded space', false);
    const edge = stickyTextfield.createEdge(embededSpace, null);
    const chunks = await stickyTextfield.contentItems.setAndAwaitChange(() =>
      stickyTextfield.insertEmbeddedEdge(edge.id),
    );
    if (!(chunks[0] instanceof VM.TextEmbed)) {
      throw new Error('The first chunk must be an embeded');
    }
    const lozenge = chunks[0];
    assert.ok(lozenge.child, 'Lozenge must be created and loaded on insertion');

    // navigate to lozenge
    route(`/topic/${embededSpace.id}`);
    await utils.awaitUrlChange(`/topic/${embededSpace.id}`);
    assert.ok(!topicSpace.alive, 'Old space must be destroyed');
  }

  // go back to RT2036 topic space
  route(`/topic/${originalTopicId}`);
  await utils.awaitUrlChange(`/topic/${originalTopicId}`);

  const tsPage = await root.topicSpace.awaitDefined();
  const ts = tsPage.topicSpace;
  {
    // check that the lozenge is loaded when the topic space is opened

    const [sticky] = await ts.members.awaitItemsInList();
    const stickyBody = await sticky.body.awaitDefined();
    const stickyTextfield = await stickyBody.content.textField.awaitDefined();
    const chunks = await stickyTextfield.contentItems.awaitItemsInList();
    if (!(chunks[0] instanceof VM.TextEmbed)) {
      throw new Error('The first chunk must be an embeded');
    }

    const tfProperty = await stickyTextfield.propertyConfig!.obs.awaitDefined();
    if (!tfProperty) {
      throw new Error('Property must load becuase it was created before');
    }
    await tfProperty.parent.edges.awaitItemsInList();

    const lozenge = chunks[0];
    assert.ok(lozenge.child, 'Lozenge must be loaded when topic space is opened');
  }
}
