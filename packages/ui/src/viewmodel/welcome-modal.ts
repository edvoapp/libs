import { VertexNode, VertexNodeCA } from './base';
import { Guard, MemoizeOwned, Observable, ObservableReader, sleep } from '@edvoapp/util';
import { AppDesktop } from './app-desktop';
import { ConditionalPanel } from './conditional-panel';
import { MODAL_PANEL_Z } from '../constants';
import { Button } from './button';
import { trxWrap } from '@edvoapp/common';
import { UserAvatar } from './user-avatar';
import { WebappExtensionBridge } from '..';
import { InputDeviceType } from './topic-space';

interface CA extends VertexNodeCA<ConditionalPanel<WelcomeModal, AppDesktop>> {}

export class WelcomeModal extends VertexNode<ConditionalPanel<WelcomeModal, AppDesktop>> {
  hasDepthMask = true;
  _depthMaskZ = MODAL_PANEL_Z[0];

  constructor({ ...args }: CA) {
    super(args);
  }

  static new(args: CA) {
    const me = new WelcomeModal(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    this.onCleanup(
      this.completedSetup.subscribe(async (val) => {
        if (val) {
          await this.vertex.setFlagProperty('new-user', false, null);
          const g = Guard.unsafe(this);
          await sleep(500);
          this.showConfetti.set(true);
          await sleep(5_000);
          this.parentNode.close();
          g.release();
        }
      }),
    );
  }

  get childProps(): (keyof this & string)[] {
    return [
      'closeButton',
      'pinExtButton',
      'mouseInputButton',
      'trackpadInputButton',
      'defaultAvatarButton',
      'showPinVideoButton',
    ];
  }

  @MemoizeOwned()
  get didPinExtension() {
    return new Observable<boolean>(false);
  }
  @MemoizeOwned()
  get showPinVideo() {
    return new Observable<boolean>(false);
  }
  @MemoizeOwned()
  get inputDevice(): ObservableReader<InputDeviceType | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<InputDeviceType | null | undefined>((user) =>
      user?.getJsonPropValuesObs<InputDeviceType>('input-device'),
    );
  }
  @MemoizeOwned()
  get didSetInput() {
    return Observable.calculated(({ input }) => input?.type, {
      input: this.inputDevice,
    });
  }
  @MemoizeOwned()
  get didChooseProfileImg() {
    return this.vertex.filterProperties({ role: ['avatar-image'] }).firstObs();
  }
  @MemoizeOwned()
  get didChooseDefaultImg() {
    return new Observable<boolean>(false);
  }
  @MemoizeOwned()
  get didInstallExt() {
    return Observable.calculated(({ extension }) => extension === 'INJECTED', {
      extension: (this.context.authService.extBridge as WebappExtensionBridge).extensionStatus,
    });
  }
  @MemoizeOwned()
  get completedSetup() {
    return Observable.calculated(
      ({ didInstallExt, didPinExtension, didSetInput, didChooseProfileImg, didChooseDefaultImg }) =>
        didInstallExt && didPinExtension && didSetInput && (didChooseProfileImg || didChooseDefaultImg),
      {
        didPinExtension: this.didPinExtension,
        didSetInput: this.didSetInput,
        didChooseProfileImg: this.didChooseProfileImg,
        didChooseDefaultImg: this.didChooseDefaultImg,
        didInstallExt: this.didInstallExt,
      },
    );
  }
  @MemoizeOwned()
  get showConfetti() {
    return new Observable<boolean>(false);
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
  get pinExtButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.didPinExtension.set(true);
        this.showPinVideo.set(false);
      },
    });
  }
  @MemoizeOwned()
  get showPinVideoButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {},
    });
  }
  @MemoizeOwned()
  get mouseInputButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.context.authService.currentUserVertexObs.value?.setJsonPropValues('input-device', { type: 'mouse' }, null);
      },
    });
  }
  @MemoizeOwned()
  get trackpadInputButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        this.context.authService.currentUserVertexObs.value?.setJsonPropValues(
          'input-device',
          { type: 'touchpad' },
          null,
        );
      },
    });
  }
  @MemoizeOwned()
  get defaultAvatarButton() {
    return Button.new({
      parentNode: this,
      onClick: () => {
        // Archive existing avatar images
        void trxWrap(async (trx) => {
          (await this.vertex.filterProperties({ role: ['avatar-image'] }).toArray())?.map((x) => x.archive(trx));
        });
        this.didChooseDefaultImg.set(true);
      },
    });
  }
  @MemoizeOwned()
  get userAvatar() {
    return UserAvatar.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
      size: 'small-medium',
    });
  }
}
