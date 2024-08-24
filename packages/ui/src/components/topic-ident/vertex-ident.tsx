import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { TopicName } from '../topic/topic-name';
import { ConditionalNode, Name, PropertyNode, TopicSpace } from '../../viewmodel';

interface Props {
  node: TopicSpace;
  nameNode: Name;
  urlNode: ConditionalNode<PropertyNode>;
  readonly?: boolean;
}

/**
 * 'VertexIdent' displays the ident (name + url) for a single Vertex.
 * */
export function VertexIdent({ node, urlNode, readonly, nameNode }: Props) {
  const ident = [];

  const plainBodyNode = useObserveValue(() => node.plainBody, [node]);
  const plainBody = useObserveValueMaybe(() => plainBodyNode?.property.text, [plainBodyNode]);
  const urlPart = useObserveValue(() => urlNode, [urlNode]);
  const url = useObserveValueMaybe(() => urlPart?.property.text, [urlPart]);

  if (plainBody) ident.push(<p className="text">{plainBody.substr(0, 500)}</p>);
  ident.push(<TopicName node={nameNode} readonly={readonly} />);
  if (url) {
    try {
      const { hostname } = new URL(url);
      ident.push(
        <span className="url" ref={(r: HTMLElement | null) => urlNode.safeBindDomElement(r)}>
          {hostname}
        </span>,
      );
    } catch {
      ident.push(
        <span className="url" ref={(r: HTMLElement | null) => urlNode.safeBindDomElement(r)}>
          Invalid URL
        </span>,
      );
    }
  }

  return <>{ident}</>;
}
