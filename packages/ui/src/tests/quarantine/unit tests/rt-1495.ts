import assert from 'assert';
import * as utils from '../utility/test-utils';
import { route } from 'preact-router';
import * as VM from '../../../viewmodel';

export async function RT1495() {
  const { root, topicSpace } = await utils.setup();

  // create the card
  const member = await utils.createMember('list', topicSpace, {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 700,
    height: 900,
  });

  return true;
}
