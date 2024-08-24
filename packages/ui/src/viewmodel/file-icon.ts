import { ChildNode, ChildNodeCA, Node } from './base';
import { Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { Model } from '@edvoapp/common';
import { TopicItem } from './topic-space';

interface CA extends ChildNodeCA<Node> {
  readonly property: ObservableReader<Model.Property | null | undefined>;
  readonly fileExtensionProperty: ObservableReader<Model.Property | null | undefined>;
  readonly faviconProperty?: ObservableReader<Model.Property | null | undefined>;
}

export class FileIcon extends ChildNode<Node> {
  @OwnedProperty
  readonly property: ObservableReader<Model.Property | null | undefined>;
  @OwnedProperty
  readonly fileExtensionProperty: ObservableReader<Model.Property | null | undefined>;
  @OwnedProperty
  readonly faviconProperty?: ObservableReader<Model.Property | null | undefined>;
  // allowHover = this.parentNode instanceof TopicItem;

  constructor({ property, fileExtensionProperty, faviconProperty, ...props }: CA) {
    super(props);
    this.property = property;
    this.fileExtensionProperty = fileExtensionProperty;
    this.faviconProperty = faviconProperty;
  }

  // get cursor(): string {
  //   const parentNode = this.parentNode;
  //   if (parentNode instanceof TopicItem) {
  //     return parentNode.isListItem ? 'default' : 'pointer';
  //   }
  //   return 'default';
  // }

  static new(args: CA) {
    const me = new FileIcon(args);
    me.init();
    return me;
  }
}
