import { Member } from './member';
import { ChildNode, ChildNodeCA, ConditionalNode, BoundingBox } from '../base';
import { DiagBox } from '../../utils';
import { ObservableReader, OwnedProperty, getWasmBindings } from '@edvoapp/util';
import * as Bindings from '@edvoapp/wasm-bindings';
import { TopicSpace } from './topic-space';
import { SELECTION_INDICATOR_Z } from '../../constants';
import { ContentCard } from './content-card';

const THICKNESS = 2;

interface CA extends ChildNodeCA<ConditionalNode<MemberSelectionIndicator, boolean, Member | ContentCard>> {
  precursor: ObservableReader<boolean>;
}

export class MemberSelectionIndicator extends ChildNode<
  ConditionalNode<MemberSelectionIndicator, boolean, Member | ContentCard>
> {
  _rectangle: Bindings.Border;
  @OwnedProperty
  precursor: ObservableReader<boolean>;

  constructor({ ...args }: CA) {
    super(args);
    this._rectangle = getWasmBindings().Border.new();
    this.precursor = args.precursor;
  }

  static new(args: CA) {
    const me = new MemberSelectionIndicator(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    const precursorObs = this.precursor;
    const clientRectObs = this.parentNode.parentNode.clientRectObs;
    const visibleObs = this.parentNode.parentNode.visible;
    const clipBoxObs = this.member.clipBox;

    // TODO convert this into an Observable to debounce redundant notifications
    const update = () => {
      const visible = visibleObs.value;
      const precursor = precursorObs.value;
      const v = clientRectObs.value;
      const clipbox = clipBoxObs?.value;

      if (visible && precursor) {
        this._rectangle.update(
          v.x,
          v.y,
          v.width,
          v.height,
          SELECTION_INDICATOR_Z,
          clipbox?.left,
          clipbox?.top,
          clipbox?.width,
          clipbox?.height,
          THICKNESS,
        );
      } else {
        this._rectangle.free();
      }
    };

    this.managedSubscription(precursorObs, update, true);
    this.managedSubscription(clientRectObs, update, true);
    this.managedSubscription(visibleObs, update, true);
    if (clipBoxObs) this.managedSubscription(clipBoxObs, update, true);
  }

  protected cleanup() {
    this._rectangle.free();
    super.cleanup();
  }

  get member(): Member | ContentCard {
    return this.parentNode.parentNode;
  }
}
