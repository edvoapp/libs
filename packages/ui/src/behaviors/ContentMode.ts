import { Action, ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';

export class ContentMode extends Behavior {
  getActions(node: VM.Node): ActionGroup[] {
    let content: VM.BodyContent | null = null;
    const topic = node.findClosest((n) => n instanceof VM.MemberBody && n);
    const dockItem = node.findClosest((n) => n instanceof VM.DockItem && n);
    const contentCard = node.findClosest((n) => n instanceof VM.ContentCard && n);
    if (topic) {
      content = topic.content;
    } else if (contentCard) {
      content = contentCard.content;
    } else if (dockItem) {
      content = dockItem.body.value?.body.content ?? null;
    }
    if (!content) return [];
    const embedAvailable = content.embedAvailable.value;
    if (!embedAvailable) return [];

    const contentMode = content.contentModeObs.value;

    const subActions: Action[] = [];

    if (contentMode !== 'embed') {
      subActions.push({
        label: 'Embed',
        apply: () => content?.setContentMode('embed'),
      });
    }

    if (contentMode !== 'page') {
      subActions.push({
        label: 'Page',
        apply: () => content?.setContentMode('page'),
      });
    }

    return [
      {
        label: 'Card',
        actions: [
          {
            label: 'Content Mode',
            subActions,
          },
        ],
      },
    ];
  }
}
