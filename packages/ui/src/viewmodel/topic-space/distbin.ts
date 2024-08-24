const eventProps: (keyof MouseEvent)[] = [
  'clientX',
  'clientY',
  'x',
  'y',
  'pageX',
  'pageY',
  'offsetX',
  'offsetY',
  'screenX',
  'screenY',
  'ctrlKey',
  'shiftKey',
  'button',
  'buttons',
  'altKey',
  'metaKey',
  'target',
  'currentTarget',
  'relatedTarget',
];

function copyMouseEvent(event: MouseEvent) {
  const options = eventProps.reduce<Partial<Record<keyof MouseEvent, MouseEvent[keyof MouseEvent]>>>((acc, prop) => {
    acc[prop] = event[prop];
    return acc;
  }, {});
  return new MouseEvent(event.type, options as MouseEventInit);
}
