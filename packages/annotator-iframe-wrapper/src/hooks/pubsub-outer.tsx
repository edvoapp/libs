import { useEffect, useState } from 'preact/hooks';
import PubSub from 'pubsub-js';
import { useNavigator } from '@edvoapp/ui';

type AppStatus = 'LOADING' | 'READY';

interface Message {
  type: string;
  payload: unknown;
}

// this is just to locally keep track of what messages we're subscribing to
const subscribedMessages = new Set();
//TODO set is not getting cleaned

export function subscribe<DataType>(message: string, cb: (data: DataType) => void) {
  subscribedMessages.add(message);
  return PubSub.subscribe(message, (_: string, data: DataType) => cb(data));
}

export function unsubscribe(tokenOrFunction: unknown) {
  return PubSub.unsubscribe(tokenOrFunction);
}

export function publish(message: string, data?: unknown) {
  if (!subscribedMessages.has(message)) return;
  if (!PubSub.publish(message, data)) {
    // throw an error maybe
    console.error(`Inner Message: ${message} failed to publish`);
  }
}

export function handleInnerMessage(e: MessageEvent) {
  const { type, payload } = e.data;
  const iframe = document.getElementById('edvo-annotator-app-inner') as HTMLIFrameElement;
  switch (type) {
    case 'INNER_BLUR': {
      iframe.classList.remove('active');
      iframe.blur();
      window.focus();
      break;
    }
    case 'INNER_FOCUS': {
      iframe.classList.add('active');
      window.blur();
      iframe.focus();
      break;
    }
    case 'CLOSE_WINDOW': {
      // this doesn't actually do anything, but keeping it in here just in case
      window.close();
      break;
    }
    default: {
      publish(type, payload);
    }
  }
}

export function publishMessageToInner(type: string, payload?: unknown) {
  try {
    (document.getElementById('edvo-annotator-app-inner') as HTMLIFrameElement).contentWindow?.postMessage(
      { type, payload },
      '*',
    );
  } catch (err: any) {
    console.error(`Publishing message ${type} to inner failed`, payload, err.toString());
  }
}

export function usePubSub() {
  const [innerAppStatus, setInnerAppStatus] = useState<AppStatus>('LOADING');
  const [messageQueue, setMessageQueue] = useState<Message[]>([]);

  useEffect(() => {
    // TODO - determine how to manage innerAppStatus while the iframe is realoading
    if (innerAppStatus === 'READY') {
      messageQueue.map(({ type, payload }) => publishMessageToInner(type, payload));
      setMessageQueue([]);
    }
  }, [innerAppStatus, messageQueue, setMessageQueue]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleInnerMessage);

      return () => {
        window.removeEventListener('message', handleInnerMessage);
      };
    }
  }, []);

  const navigator = useNavigator();

  useEffect(() => {
    const token = subscribe('NOTIFY/INNER_READY', () => {
      setInnerAppStatus('READY');
    });
    return () => unsubscribe(token);
  }, [setInnerAppStatus, navigator]);
}

export function useSubscribeOnMount<DataType = unknown>(
  message: string,
  cb: (data: DataType) => void,
  deps: ReadonlyArray<unknown> = [],
) {
  useEffect(() => {
    const token = subscribe<DataType>(message, cb);
    return () => unsubscribe(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, cb, ...deps]);
}
