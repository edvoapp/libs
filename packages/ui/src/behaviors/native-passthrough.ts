import { Behavior } from '..';
import { EventNav, DispatchStatus } from '../service';
import { Node } from '../viewmodel';

export class NativePassthrough extends Behavior {
  handleMouseDown(eventNav: EventNav, e: MouseEvent, node: Node<Node<any> | null>): DispatchStatus {
    return 'native';
  }
}
