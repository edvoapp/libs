import { Fragment, FunctionalComponent, h, JSX } from 'preact';
import { useCallback, useState } from 'preact/hooks';

import { publishMessageToInner, useSubscribeOnMount } from '../../hooks/pubsub';
import './style.scss';

interface PhantomDivProps {
  style: JSX.CSSProperties;
  id: string;
  events: ('focus' | 'click')[];
}

export const PhantomDom: FunctionalComponent = () => {
  const [phantoms, setPhantoms] = useState<Record<string, PhantomDivProps>>({});

  useSubscribeOnMount<PhantomDivProps>('CREATE_PHANTOM', ({ style, id, events }) => {
    setPhantoms((p) => ({ ...p, [id]: { style, id, events } }));
  });

  useSubscribeOnMount<{ id: string }>('REMOVE_PHANTOM', ({ id }) => {
    setPhantoms(({ [id]: s, ...p }) => p);
  });

  const handlePhantomClick = useCallback((id: string, event: MouseEvent) => {
    const { clientX, clientY } = event;
    const iframe = document.getElementById('edvo-annotator-app-inner');
    if (iframe) {
      iframe.classList.add('active');
    }
    publishMessageToInner(`PHANTOM_CLICK`, { event: { clientX, clientY } });
  }, []);

  return (
    <Fragment>
      {Object.entries(phantoms).map(([id, { style, events }]) => {
        const props: JSX.HTMLAttributes & JSX.SVGAttributes & Record<string, any> = {
          id,
          key: id,
          className: 'phantomDiv',
          style,
        };
        if (events.includes('click')) {
          props.onClick = (event: MouseEvent) => handlePhantomClick(id, event);
        }
        return h('div', props);
      })}
    </Fragment>
  );
};
