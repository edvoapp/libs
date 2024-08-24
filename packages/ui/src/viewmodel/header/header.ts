import { ChildNode, ChildNodeCA, ConditionalNode, Node } from '../base';
import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';
import { CurrentUserAvatar } from '../user/user-settings-avatar';
import { Model, trxWrap } from '@edvoapp/common';
import { AppDesktop } from '../app-desktop';
import { Behavior, DispatchStatus, EventNav, useNavigator } from '../../service';
import { DEPTH_MASK_Z } from '../../constants';
import { Button } from '../button';
import { isFullScreenable } from '../../behaviors';

interface CA extends ChildNodeCA<AppDesktop> {}

export class Header extends ChildNode<AppDesktop> {
  readonly label = 'header';
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;
  overflow = true; // for user settings modal
  @OwnedProperty
  navigationHistory = this.context.navigationHistory;

  static new(args: CA) {
    const me = new Header(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['userAvatar', 'exitTileModeButton', 'newSpaceButton', 'searchButton', 'forwardButton', 'backButton'];
  }

  @OwnedProperty
  heightObs = this.parentNode.tileContainer.visible.mapObs((v) =>
    // for now, not squishing the header
    v ? 60 : 60,
  );
  @MemoizeOwned()
  get userAvatar() {
    return ConditionalNode.new<CurrentUserAvatar, Model.Vertex | null | undefined>({
      parentNode: this,
      precursor: this.context.authService.currentUserVertexObs,
      factory: (user, parentNode) => {
        if (!user) return undefined;

        return CurrentUserAvatar.new({
          parentNode,
          vertex: user,
          context: this.context,
        });
      },
    });
  }

  @MemoizeOwned()
  get exitTileModeButton(): ConditionalNode<ExitTileModeButton, boolean, Header> {
    const tileContainer = this.parentNode.tileContainer;
    const tileModeActive = tileContainer.visible;

    return ConditionalNode.new<ExitTileModeButton, boolean, Header>({
      precursor: tileModeActive,
      parentNode: this,
      factory: (want, parentNode) => (want ? ExitTileModeButton.new({ parentNode }) : null),
    });
  }

  @MemoizeOwned()
  get newSpaceButton() {
    type ProgressStatus =
      | 'OPEN' // open to create a new topic space
      | 'IN_PROGRESS'; // in progress of creating a new topic space
    let status: ProgressStatus = 'OPEN';
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode;
        if (!(root instanceof AppDesktop)) return;

        // avoids to create a never used topic space
        if (status != 'OPEN') return;
        status = 'IN_PROGRESS';

        const tiledItems = root.tileContainer.children;
        for (const item of tiledItems) {
          if (isFullScreenable(item)) {
            root.tileContainer.remove(item);
          }
        }
        void trxWrap(async (trx) => {
          const vertex = Model.Vertex.create({ name: 'Untitled', trx });
          return vertex;
        })
          .then((vertex) => {
            // navigates after vertex is saved in DB
            const nav = useNavigator();
            nav.openTopic(vertex);
          })
          .finally(() => {
            // re-enables to create another new topic space under succes or crash
            status = 'OPEN';
          });
      },
    });
  }

  @MemoizeOwned()
  get searchButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode as AppDesktop;
        root.tileContainer.clear();
        if (!root.searchPanel.isFocused.value) {
          root.setSearchMode('standard');
        } else {
          if (root.searchMode.value !== 'standard') {
            root.setSearchMode('standard');
          } else {
            root.setSearchMode('hidden');
          }
        }
      },
    });
  }

  @MemoizeOwned()
  get forwardButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode as AppDesktop;
        const tiledItems = root.tileContainer.children;
        for (const item of tiledItems) {
          if (isFullScreenable(item)) {
            root.tileContainer.remove(item);
          }
        }
        const direction = 1; //forwards
        this.navigationHistory.go(direction);
      },
    });
  }
  @MemoizeOwned()
  get backButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        const root = this.context.rootNode as AppDesktop;
        const tiledItems = root.tileContainer.children;
        for (const item of tiledItems) {
          if (isFullScreenable(item)) {
            root.tileContainer.remove(item);
          }
        }
        const direction = -1; //backwards
        this.navigationHistory.go(direction);
      },
    });
  }
}

interface ExitTileModeButtonCA extends ChildNodeCA<ConditionalNode<ExitTileModeButton, boolean, Header>> {}

export class ExitTileModeButton extends ChildNode<ConditionalNode<ExitTileModeButton, boolean, Header>> {
  static new(args: ExitTileModeButtonCA) {
    const me = new ExitTileModeButton(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new ExitTileModeButtonClick()];
  }
}

class ExitTileModeButtonClick extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const btn = originNode.closestInstance(ExitTileModeButton);
    if (!btn) return 'decline';
    const root = btn.root as AppDesktop;
    root.tileContainer.clear();
    return 'stop';
  }
}
