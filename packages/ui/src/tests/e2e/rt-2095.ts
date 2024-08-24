import assert from 'assert';
import * as VM from '../../viewmodel';
import * as utils from '../utility/test-utils';

// Regression test for PLM-2095 - ensure that text can be pasted into stickies and bullets
// https://edvo.atlassian.net/browse/PLM-2095
// fails on 137565e239d76cb21b97faa69f824ae7f9936cb5 (asterisk**)
export async function RT2095() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();

  const sticky = await utils.createMember('stickynote', topicSpace, {}, 'sticky');

  // start with a clean clipboard, but need to focus the document first
  window.focus();
  document.body.focus();
  await navigator.clipboard.writeText('foobar');
  const textfield = sticky.body.value?.content.textField.value;
  assert.ok(textfield);

  // focus on the sticky's body
  await ctx.focusState.setFocus(textfield, {});

  const prop = textfield.propertyConfig?.currentProperty;
  assert.ok(prop);
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', 'foobar');
  // asterisk**: the underlying bug is that cmd-v was not properly dispatching the paste event
  // but, the browser treats cmd-v events as discrete keyboard events, NOT as proxies to paste (this is the case for all browser hotkeys
  // and this is a browser issue, not a playwright issue)
  // thus, the following line of code will always FAIL, even when the bug is fixed
  // await prop.triggerChange(() => keyPress('v', { metaKey: true }));

  // On the other hand, the following line of code will always PASS, even when the bug is NOT fixed
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
  assert.equal(prop.text.value, 'stickyfoobar');
}
