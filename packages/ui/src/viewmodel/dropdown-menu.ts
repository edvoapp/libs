import { NativePassthrough } from '../behaviors';
import { Behavior } from '../service';
import { Node } from './base';

export class DropdownMenu extends Node {
  getLocalBehaviors(): Behavior[] {
    return [new NativePassthrough()];
  }
}
