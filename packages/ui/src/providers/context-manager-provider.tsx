import { loadState, Observable, saveState } from '@edvoapp/util';
import { createContext, FunctionComponent } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks'; // Approved
import { Model } from '@edvoapp/common';
import { BaseExtensionBridge, ContextManager, Navigator, setGlobalNavigator, WebappExtensionBridge, Spinner } from '..';

import { useProvider } from './common';

interface ContextManagerContextParams {
  contextManager: ContextManager;
  extBridge: WebappExtensionBridge;
}

export const ContextManagerContext = createContext<ContextManagerContextParams | null>(null);

const storageProvider = {
  async setStorageValue<T>(key: string, value: T): Promise<void> {
    saveState<T>(key, value);
  },
  async getStorageValue<T>(key: string, fallback?: T): Promise<T | string | undefined> {
    return loadState<T>(key) || fallback;
  },
};

export const ContextManagerContextProvider: FunctionComponent<{
  extBridge: WebappExtensionBridge;
}> = ({ children, extBridge }) => {
  const [contextManager, setContextManager] = useState<ContextManager | null>(); // Approved
  const timeoutRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  const initContext = () => {
    const ctx = new ContextManager({
      entity: new Observable<Model.Vertex | null>(null),
      storage: storageProvider,
    });

    const nav = new Navigator(extBridge);
    setGlobalNavigator(nav);
    setContextManager(ctx);
    // these just came from the extension; once we initialize the context manager we don't need it anymore
    // removeState('currentQuestIds')
    // removeState('currentTopicId')
  };

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const {
        data: { type, payload },
      } = event;
      switch (type) {
        case 'NOTIFY/CONTEXT_UPDATE': {
          handleInit();
          break;
        }
        default: {
          break;
        }
      }
    }
    // for backward compatibility
    // TODO: remove this after a few weeks
    function handleMessageOld(
      e: CustomEvent<{
        context: { currentQuestIds?: string[]; currentTopicId?: string };
      }>,
    ) {
      const {
        context: { currentQuestIds, currentTopicId },
      } = e.detail;
      if (currentQuestIds) saveState('currentQuestIds', currentQuestIds);
      if (currentTopicId) saveState('currentTopicId', currentTopicId);

      initContext();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
    function handleInit() {
      initContext();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
    window.addEventListener('message', handleMessage);
    document.addEventListener('NOTIFY/CONTEXT_UPDATE', handleMessageOld as EventListener);

    // if we never get a handleInit, it means that the extension is probably not installed. So, we init context anyway.
    timeoutRef.current = setTimeout(initContext, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('NOTIFY/CONTEXT_UPDATE', handleMessageOld as EventListener);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  if (!contextManager)
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Spinner className="animate-spin h-10 w-10 text-indigo-600" />
      </div>
    );

  return (
    <ContextManagerContext.Provider
      value={{
        contextManager,
        extBridge,
      }}
    >
      {children}
    </ContextManagerContext.Provider>
  );
};

export const useContextManagerContext = () => useProvider(ContextManagerContext, 'quest');
