import { RoutableProps, route } from 'preact-router';
import * as VM from '../../viewmodel';
import { useEffect } from 'preact/hooks';
import { useObserveValue } from '@edvoapp/util';

export interface Props extends RoutableProps {
  node: VM.NewTopicPage;
}

export function NewTopicPage({ node }: Props) {
  const recentTopic = useObserveValue(() => node.mostRecentTopic, [node]);
  useEffect(() => {
    if (node.type === 'new-topic') void node.createNewTopic();
    else if (node.type === 'recent-topic') {
      if (recentTopic) route(`/topic/${recentTopic.id}`);
    }
  }, [node, recentTopic]);
  return <></>;
}
