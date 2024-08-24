import { Model } from '@edvoapp/common';
import { VertexIdent } from './vertex-ident';
import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import './topic-ident.scss';
import { TopicName } from '../topic/topic-name';
import { TopicSpace } from '../../viewmodel';
import { Nameable } from '../../viewmodel/types';

export interface TopicIdentProps {
  node: Nameable;
  readonly?: boolean;
}

export const TopicIdent = ({ node, readonly }: TopicIdentProps) => {
  const nameNode = node.topicName;

  if (node instanceof TopicSpace) {
    const urlNode = node.urlPart;
    return <VertexIdent node={node} urlNode={urlNode} nameNode={nameNode} readonly={readonly} />;
  }

  return <TopicName node={nameNode} readonly={readonly} />;
};
