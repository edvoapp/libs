import { ChildNode, ChildNodeCA, ListNode, Node, NodeCA } from '../base';
import { capitalize, MemoizeOwned, Observable, ObservableList, ObservableReader } from '@edvoapp/util';
import { AppDesktop } from '../app-desktop';
import { ConditionalPanel } from '../conditional-panel';
import { Clickable } from '../../behaviors';
import { doExport } from './export';
import { MODAL_PANEL_Z } from '../../constants';
import { TrxRef, trxWrap } from '@edvoapp/common';

type InputDeviceType = {
  type: 'mouse' | 'touchpad' | 'auto';
};

type PanDirection = {
  natural: boolean;
};

type ZoomDirection = {
  swipeUpToZoomIn: boolean;
};

const generalSettings = ['export-graph', 'debug-panel'] as const;
const canvasPreferences = ['natural-panning', 'zoom', 'input-device', 'double-click-to-create'] as const;
const betaFeatures = ['blobbies', 'surround', 'progressive-rendering'] as const;

type GeneralSetting = typeof generalSettings[number];
type CanvasPreference = typeof canvasPreferences[number];
type BetaFeature = typeof betaFeatures[number];
type OptionButton = GeneralSetting | CanvasPreference | BetaFeature;

interface CA extends NodeCA<ConditionalPanel<AppSettingsModal, AppDesktop>> {}

export class AppSettingsModal extends Node<ConditionalPanel<AppSettingsModal, AppDesktop>> {
  hasDepthMask = true;
  _depthMaskZ = MODAL_PANEL_Z[0];

  static new(args: CA) {
    const me = new AppSettingsModal(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['generalSettingsButtons', 'canvasPreferencesButtons', 'betaFeaturesButtons'];
  }

  @MemoizeOwned()
  get generalSettingsButtons() {
    const precursor = new ObservableList<OptionButton>([...generalSettings]);
    return ListNode.new<AppSettingsModal, AppSettingButton, OptionButton>({
      parentNode: this,
      precursor,
      factory: (type, parentNode) => AppSettingButton.new({ type, parentNode }),
    });
  }

  @MemoizeOwned()
  get canvasPreferencesButtons() {
    const precursor = new ObservableList<OptionButton>([...canvasPreferences]);
    return ListNode.new<AppSettingsModal, AppSettingButton, OptionButton>({
      parentNode: this,
      precursor,
      factory: (type, parentNode) => AppSettingButton.new({ type, parentNode }),
    });
  }

  @MemoizeOwned()
  get betaFeaturesButtons() {
    const precursor = new ObservableList<OptionButton>([...betaFeatures]);
    return ListNode.new<AppSettingsModal, AppSettingButton, OptionButton>({
      parentNode: this,
      precursor,
      factory: (type, parentNode) => AppSettingButton.new({ type, parentNode }),
    });
  }

  get focusable() {
    return true;
  }
}

type AppSettingButtonParent = ListNode<AppSettingsModal, AppSettingButton, OptionButton>;
interface AppSettingButtonCA extends ChildNodeCA<AppSettingButtonParent> {
  type: OptionButton;
}

export class AppSettingButton extends ChildNode<AppSettingButtonParent> implements Clickable {
  type: OptionButton;

  constructor({ type, ...args }: AppSettingButtonCA) {
    super(args);
    this.type = type;
  }

  static new(args: AppSettingButtonCA) {
    const me = new AppSettingButton(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get panDirection(): ObservableReader<PanDirection | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<PanDirection | null | undefined>((user) =>
      user ? user.getJsonPropValuesObs<PanDirection>('pan-direction') : user,
    );
  }

  async togglePanDirection(trx: TrxRef) {
    const panDirection = await this.panDirection.get();
    const natural = !panDirection?.natural;
    // set to natural                     : true => false
    // not set to natural                 : false => true
    // not set at all: defaults to natural: true => false
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('pan-direction', { natural }, trx);
  }
  async setPanDirection(trx: TrxRef, natural: boolean) {
    await this.context.authService.currentUserVertexObs.value?.setJsonPropValues('pan-direction', { natural }, trx);
  }

  @MemoizeOwned()
  get zoomDirection(): ObservableReader<ZoomDirection | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<ZoomDirection | null | undefined>((user) =>
      user?.getJsonPropValuesObs<ZoomDirection>('zoom-direction'),
    );
  }

  async toggleZoomDirection(trx: TrxRef) {
    const zoomDirection = await this.zoomDirection.get();
    const swipeUpToZoomIn = !zoomDirection?.swipeUpToZoomIn;
    // set to natural                     : true => false
    // not set to natural                 : false => true
    // not set at all: defaults to natural: true => false
    await this.context.authService.currentUserVertexObs.value?.setJsonPropValues(
      'zoom-direction',
      { swipeUpToZoomIn },
      trx,
    );
  }
  async setZoomDirection(trx: TrxRef, swipeUpToZoomIn: boolean) {
    await this.context.authService.currentUserVertexObs.value?.setJsonPropValues(
      'zoom-direction',
      { swipeUpToZoomIn },
      trx,
    );
  }

  @MemoizeOwned()
  get debugPanelEnabled(): ObservableReader<boolean> {
    return this.context.authService.currentUserVertexObs.mapObs<boolean>(
      (user) => user?.getFlagPropertyObs('debug-panel-enabled').mapObs((v) => !!v) ?? false,
    );
  }

  async toggleDebugPanel(trx: TrxRef) {
    await this.context.authService.currentUserVertexObs.value?.toggleFlagProperty('debug-panel-enabled', trx);
  }

  @MemoizeOwned()
  get inputDevice(): ObservableReader<InputDeviceType | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<InputDeviceType | null | undefined>((user) =>
      user?.getJsonPropValuesObs<InputDeviceType>('input-device'),
    );
  }

  async toggleInputDevice(trx: TrxRef) {
    const inputDevice = await this.inputDevice.get();
    const currentType = inputDevice?.type;
    const value = { type: 'mouse' };
    switch (currentType) {
      case 'auto':
        value.type = 'mouse';
        break;
      case 'mouse':
        value.type = 'touchpad';
        break;
      case 'touchpad':
        value.type = 'auto';
        break;
      default:
        value.type = 'mouse';
        break;
    }
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('input-device', value, trx);
  }

  async setInputDevice(trx: TrxRef, value: InputDeviceType) {
    this.context.authService.currentUserVertexObs.value?.setJsonPropValues('input-device', value, trx);
  }

  @MemoizeOwned()
  get doubleClickToCreateEnabled(): ObservableReader<boolean | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<boolean | null | undefined>((user) =>
      user ? user.getFlagPropertyObs('double-click-to-create-enabled').mapObs((v) => !!v) : user,
    );
  }

  async toggleDoubleClickToCreate(trx: TrxRef) {
    await this.context.authService.currentUserVertexObs.value?.toggleFlagProperty(
      'double-click-to-create-enabled',
      trx,
    );
  }

  @MemoizeOwned()
  get blobbiesEnabled(): ObservableReader<boolean | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<boolean | null | undefined>((user) =>
      user ? user.getFlagPropertyObs('blobbies-enabled').mapObs((v) => !!v) : null,
    );
  }

  async toggleBlobbies(trx: TrxRef) {
    await this.context.authService.currentUserVertexObs.value?.toggleFlagProperty('blobbies-enabled', trx);
  }

  @MemoizeOwned()
  get tileModeSurroundEnabled(): ObservableReader<boolean | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<boolean | null | undefined>((user) =>
      user ? user.getFlagPropertyObs('tile-mode-surround-enabled').mapObs((v) => !!v) : null,
    );
  }

  async toggleTileModeSurround(trx: TrxRef) {
    await this.context.authService.currentUserVertexObs.value?.toggleFlagProperty('tile-mode-surround-enabled', trx);
  }

  @MemoizeOwned()
  get progressiveRenderingEnabled(): ObservableReader<boolean | null | undefined> {
    return this.context.authService.currentUserVertexObs.mapObs<boolean | null | undefined>((user) =>
      user ? user.getFlagPropertyObs('progressive-rendering-enabled').mapObs((v) => !!v) : null,
    );
  }

  async toggleProgressiveRendering(trx: TrxRef) {
    await this.context.authService.currentUserVertexObs.value?.toggleFlagProperty('progressive-rendering-enabled', trx);
  }

  @MemoizeOwned()
  get control(): ObservableReader<string> {
    switch (this.type) {
      case 'debug-panel':
        return this.debugPanelEnabled.mapObs((x) => (x ? 'Disable' : 'Enable'));
      case 'natural-panning':
        return this.panDirection.mapObs((x) => (x?.natural ? 'Disable' : 'Enable'));
      case 'zoom':
        return this.zoomDirection.mapObs((x) => (x?.swipeUpToZoomIn ? 'down' : 'up'));
      case 'input-device':
        return this.inputDevice.mapObs((x) => {
          const type = x?.type;
          return type ? capitalize(type) : 'Auto';
        });
      case 'double-click-to-create':
        return this.doubleClickToCreateEnabled.mapObs((x) => (x ? 'Disable' : 'Enable'));
      case 'blobbies':
        return this.blobbiesEnabled.mapObs((x) => (x ? 'Disable' : 'Enable'));
      case 'surround':
        return this.tileModeSurroundEnabled.mapObs((x) => (x ? 'Disable' : 'Enable'));
      case 'progressive-rendering':
        return this.progressiveRenderingEnabled.mapObs((x) => (x ? 'Disable' : 'Enable'));
      default:
        return new Observable('');
    }
  }

  @MemoizeOwned()
  get buttonLabel() {
    return this.control.mapObs((control) => {
      switch (this.type) {
        case 'export-graph':
          return 'Export My Graph';
        case 'debug-panel':
          return `${control} Debug Panel`;
        case 'natural-panning':
          return `${control} Natural Panning`;
        case 'zoom':
          return `Swipe ${control} to zoom in`;
        case 'input-device':
          return `Input Device (toggle if having issues zooming/panning): ${control}`;
        case 'double-click-to-create':
          return `${control} Double Click to Create`;
        case 'blobbies':
          return `${control} relational blobs`;
        case 'surround':
          return `${control} tile mode surround view`;
        case 'progressive-rendering':
          return `${control} progressive rendering`;
      }
    });
  }
  onClick() {
    void trxWrap(async (trx) => {
      switch (this.type) {
        case 'export-graph':
          await doExport();
          return;
        case 'debug-panel':
          await this.toggleDebugPanel(trx);
          return;
        case 'natural-panning':
          await this.togglePanDirection(trx);
          return;
        case 'zoom':
          await this.toggleZoomDirection(trx);
          return;
        case 'input-device':
          await this.toggleInputDevice(trx);
          return;
        case 'double-click-to-create':
          await this.toggleDoubleClickToCreate(trx);
          return;
        case 'blobbies':
          await this.toggleBlobbies(trx);
          return;
        case 'surround':
          await this.toggleTileModeSurround(trx);
          return;
        case 'progressive-rendering':
          await this.toggleProgressiveRendering(trx);
          return;
      }
    });
  }
}
