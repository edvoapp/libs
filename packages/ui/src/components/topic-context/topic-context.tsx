import { Model } from '@edvoapp/common';
import { createContext, VNode } from 'preact';
import { useContext } from 'preact/hooks';

export interface TopicContextParams {
  topic?: Model.Vertex;
}

export const TopicContext = createContext<TopicContextParams | null>(null);

interface TopicContextProviderProps {
  children: VNode;
  topic: Model.Vertex;
}

export function TopicContextProvider({ children, topic }: TopicContextProviderProps) {
  return <TopicContext.Provider value={{ topic }}>{children}</TopicContext.Provider>;
}
export const TopicContextConsumer = TopicContext.Consumer;

export function useTopicContext(): NonNullable<TopicContextParams> {
  const topicContext = useContext(TopicContext);
  if (topicContext === null) {
    return {};
  }
  return topicContext;
}
