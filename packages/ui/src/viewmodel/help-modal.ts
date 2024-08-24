import { ChildNode, ChildNodeCA, ListNode, Node, NodeCA } from './base';
import { capitalize, MemoizeOwned, Observable, ObservableList, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { AppDesktop } from './app-desktop';
import { ConditionalPanel } from './conditional-panel';
import { Clickable } from '../behaviors';
import { MODAL_PANEL_Z } from '../constants';
import { Button } from './button';

interface CA extends NodeCA<ConditionalPanel<HelpModal, AppDesktop>> {}

export class HelpModal extends Node<ConditionalPanel<HelpModal, AppDesktop>> {
  hasDepthMask = true;
  _depthMaskZ = MODAL_PANEL_Z[0];

  constructor({ ...args }: CA) {
    super(args);
  }

  static new(args: CA) {
    const me = new HelpModal(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['anchorButtons', 'closeButton', 'section'];
  }

  get sections() {
    return [
      'Create a new space',
      'Bring in browser tabs',
      'Bring in files',
      'Search or switch spaces',
      'Group things',
      'Optimize canvas settings',
      'Troubleshooting',
    ];
  }

  @MemoizeOwned()
  get currentSection() {
    return new Observable<string>('Create a new space');
  }

  @MemoizeOwned()
  get anchorButtons() {
    return ListNode.new<HelpModal, AnchorButton, string>({
      parentNode: this,
      precursor: new ObservableList(this.sections),
      factory: (section, parentNode) =>
        AnchorButton.new({
          section,
          parentNode,
          selected: this.currentSection?.mapObs((s) => s.toLowerCase() === section.toLowerCase()),
        }),
    });
  }

  @MemoizeOwned()
  get closeButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.parentNode.toggle();
      },
    });
  }
  @MemoizeOwned()
  get section() {
    return Section.new({
      parentNode: this,
      sections: this.sections,
    });
  }
}

interface AnchorButtonCA extends ChildNodeCA<ListNode<HelpModal, AnchorButton, string>> {
  section: string;
  selected: ObservableReader<boolean>;
}

export class AnchorButton extends ChildNode<ListNode<HelpModal, AnchorButton, string>> implements Clickable {
  section: string;
  @OwnedProperty
  selected: ObservableReader<boolean>;

  constructor({ section, selected, ...args }: AnchorButtonCA) {
    super(args);
    this.section = section;
    this.selected = selected;
  }

  static new(args: AnchorButtonCA) {
    const me = new AnchorButton(args);
    me.init();
    return me;
  }

  onClick() {
    const targetId = this.domElement?.getAttribute('data-target');
    const targetElement = targetId && document.getElementById(targetId);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

      this.parentNode.parentNode.currentSection.set(this.section);
    }
  }
}

interface SectionCA extends ChildNodeCA<HelpModal> {
  sections: string[];
}
export class Section extends ChildNode<HelpModal> {
  sections: string[];
  constructor({ sections, ...args }: SectionCA) {
    super(args);
    this.sections = sections;
  }

  static new(args: SectionCA) {
    const me = new Section(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['sectionTitle'];
  }

  setCurrentSection(section: string) {
    this.parentNode.currentSection.set(section);
  }

  @MemoizeOwned()
  get sectionTitle() {
    return ListNode.new<Section, SectionTitle, string>({
      parentNode: this,
      precursor: new ObservableList(this.sections),
      factory: (section, parentNode) =>
        SectionTitle.new({
          section,
          parentNode,
        }),
    });
  }
}

interface SectionTitleCA extends ChildNodeCA<ListNode<Section, SectionTitle, string>> {
  section: string;
}

export class SectionTitle extends ChildNode<ListNode<Section, SectionTitle, string>> {
  section: string;

  constructor({ section, ...args }: SectionTitleCA) {
    super(args);
    this.section = section;
  }

  static new(args: SectionTitleCA) {
    const me = new SectionTitle(args);
    me.init();
    return me;
  }

  get text() {
    return capitalize(this.section);
  }
}
