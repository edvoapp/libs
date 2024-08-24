import { MemoizeOwned, Observable, ObservableReader } from '@edvoapp/util';
import * as Behaviors from '../../behaviors';
import { BoundingBox, Node, NodeCA } from '../base';
import { ContextMenu } from '../context-menu';
import { LassoBehavior } from '../lasso';
import { ExtensionPopup } from './extension-popup';
import { TopicSearchList } from '../topic-search-list';

interface CA extends NodeCA<null> {}

export class AppExtension extends Node<null> {
  constructor({ ...args }: CA) {
    super(args);
  }

  static new(args: CA) {
    const me = new AppExtension(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['contextMenu', 'extensionPopup'];
  }

  doLayout() {
    super.doLayout();

    const element = this.domElement;
    if (!element) return null; // Cannot establish a coordinate frame without an element
    const box = BoundingBox.fromDomRect(element.getBoundingClientRect());
    (this.clientRectObs as Observable<BoundingBox>).set(box);
  }

  getHeritableBehaviors() {
    // TODO: determine which of these behaviors we actually care about in the extension.
    return [
      new Behaviors.CreateArrow(),
      new Behaviors.RadialNavAction(),
      new Behaviors.Wheel(),
      new LassoBehavior(),
      new Behaviors.Resize(),
      new Behaviors.PointerAction(),
      new Behaviors.Undo(),
      new Behaviors.Indent(),
      new Behaviors.OutlineItem(),
      new Behaviors.Text(),
      new Behaviors.Selection(), // After text
      new Behaviors.KeyFocus(),
      new Behaviors.PointerFocus(),
      new Behaviors.ClickSelector(),
      new Behaviors.DragDrop(),
      new Behaviors.PinTopic(),
      new Behaviors.ContextMenu(),
      new Behaviors.AddAction(),
      new Behaviors.ManualAppearance(),
      new Behaviors.AppearanceType(),
      new Behaviors.OutlineItemAppearanceType(),
      new Behaviors.MouseActionProperty(),
      new Behaviors.JumpTo(),
      new Behaviors.CardColor(),
      new Behaviors.ContentMode(),
      new Behaviors.UnlinkItem(),
      new Behaviors.ZIndex(),
      new Behaviors.CenterViewport(),
      new Behaviors.TopicArchive(),
      new Behaviors.FullScreen(),
      new Behaviors.Download(),
      new Behaviors.AutoBox(),
      new Behaviors.BulletCutCopy(),
    ];
  }

  @MemoizeOwned()
  get contextMenu() {
    return ContextMenu.new({ parentNode: this });
  }

  @MemoizeOwned()
  get extensionPopup() {
    return ExtensionPopup.new({ parentNode: this, context: this.context });
  }

  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    return super.clientRectObs;
  }
}
