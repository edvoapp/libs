import assert from 'assert';
import { createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { BoundingBox, Member, Node } from '../../../viewmodel';

// https://edvo.atlassian.net/browse/PLM-1802
// Tests that the clipboxes of all visible nodes are not 0x0. (probably not all)
export async function RT1802() {
  const root = await initRoot();
  const topicspace = getTopicSpace(root);

  {
    await createMember(300, 300, 300, 300, 'stickynote', topicspace);
    await createMember(400, 300, 300, 300, 'stickynote', topicspace);
    await createMember(500, 300, 300, 300, 'stickynote', topicspace);
  }

  // 1. get all visible nodes with a filter on hasDepthMask and visible
  const filter = (n: Node<Node<any> | null> | Member) => n.hasDepthMask && n.visible.value;
  const rootChildren = root.children.filter(filter);
  const topicspaceChildren = topicspace.children.filter(filter);
  const members = topicspace.members.value.filter(filter);

  // 2. check that their clipboxes are not 0x0
  {
    const rect = new BoundingBox({ x: 0, y: 0, width: 0, height: 0 });
    const check = (array: Node<Node<any> | null>[] | Member[]) => {
      array.forEach(async (n) => {
        await n.clientRectObs.setAndAwaitChange(() => {});
        assert.ok(!n.clientRectObs.value.compare(rect));
      });
    };
    [rootChildren, topicspaceChildren, members].forEach(check);
  }

  return true;
}
