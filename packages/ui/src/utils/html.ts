/**
 * Auto-sizes the given textArea to be as tall as it needs to be to fit its content.
 * Assumes the the box-sizing for the text area is "border-box", or this will be wonky and
 * inexact. Also assumes no border on the text area.
 *
 * TODO: This method has some jitter. Investigate better ways.
 */
export function autoSize(textArea: HTMLTextAreaElement) {
  textArea.style.height = 'auto';
  setTimeout(() => {
    textArea.style.height = textArea.scrollHeight + 'px';
  }, 10);
}
