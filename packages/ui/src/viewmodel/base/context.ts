import { Model, Registry } from '@edvoapp/common';
import {
  AsyncMutex,
  EdvoObj,
  getWasmBindings,
  Observable,
  OwnedProperty,
  QueryString,
  WeakProperty,
} from '@edvoapp/util';
import { AuthService, EventNav, FocusState, NavigationHistory, SelectionState, VM, WebappExtensionBridge } from '../..';
import * as Bindings from '@edvoapp/wasm-bindings';

import { ShareHelper } from './share-helper';
import { VertexNode } from './vertex-node';
import { Node } from './view-model-node';
import { getCurrentUrl } from 'preact-router';

export type AppLocation = {
  path: string[];
  params: Record<string, string>;
};

export type PointerMoveMode = 'modkey' | 'default';

export type Dimensions = {
  height: number;
  width: number;
};

let _globalContext: ViewModelContext | undefined;
export function initGlobalContext(authService: AuthService) {
  _globalContext = new ViewModelContext(authService, authService.extBridge as WebappExtensionBridge).leak();
}
export function globalContext(): ViewModelContext {
  if (_globalContext) return _globalContext;
  throw 'globalContext is uninitialized';
}

// TODO move this to EdvoObjShared
export class ViewModelContext extends EdvoObj {
  @OwnedProperty
  readonly location: Observable<AppLocation>;
  @OwnedProperty
  modeObs = new Observable<PointerMoveMode>('default');
  @OwnedProperty
  selectionState = new SelectionState();
  @OwnedProperty
  focusState = new FocusState();
  @OwnedProperty
  navigationHistory = new NavigationHistory();
  // Weak references
  floatingPanels = new Set<Node>();
  @OwnedProperty
  clientSizeObs = new Observable<Dimensions>({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  @WeakProperty
  rootNode: VM.AppDesktop | VM.AppExtension | null = null;
  awaitRootNode: Promise<typeof this.rootNode>;
  rootNodeSet?: (node: any) => void;
  @OwnedProperty
  depthMaskService?: Bindings.DepthMaskService;
  constructor(
    readonly authService: AuthService,
    readonly extBridge?: WebappExtensionBridge,
    readonly forceLoadChildren?: boolean,
  ) {
    super();

    this.location = new Observable<AppLocation>(this.currentLocation);

    this.addManagedListener(window, 'resize', (_event) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio;
      this.clientSizeObs.set({
        width,
        height,
      });
      getWasmBindings().get_app_controller().resize(width, height, dpr);
    });

    // hanlde changes in dpr
    {
      const dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      this.addManagedListener(dprMediaQuery, 'change', dprChanged);
    }

    this.awaitRootNode = new Promise<any>((resolve) => {
      this.rootNodeSet = resolve;
    });

    // we need to wait for the app controller to be loaded before we can create the depth mask service
    setTimeout(() => (this.depthMaskService = getWasmBindings().DepthMaskService.new()), 0);

    extBridge?.addMessageListener('NOTIFY/FOCUS', () => {
      this.focusState.checkActiveFocus();
    });
  }
  get currentUser() {
    return this.authService.currentUserVertexObs;
  }
  setRootNode(node: VM.AppDesktop | VM.AppExtension) {
    this.rootNode = node;
    this.focusState.currentFocus = node;
    this.rootNodeSet?.(node);
  }
  get currentLocation(): AppLocation {
    let pathString;
    let queryString;
    if (this.runtime === 'electron') {
      const currentUrl = getCurrentUrl();
      const firstQuestionMark = currentUrl.indexOf('?');

      if (firstQuestionMark !== -1) {
        pathString = currentUrl.slice(0, firstQuestionMark);
        queryString = currentUrl.slice(firstQuestionMark + 1);
      } else {
        pathString = currentUrl;
      }
    } else {
      pathString = window.location.pathname;
      queryString = window.location.search;
    }
    const path = pathString.split('/').filter((v) => v.length > 0); // throw away leading ''
    const params = QueryString.parse(queryString);

    return { path, params };
  }
  get runtime(): 'electron' | 'webapp' | 'extension' {
    const userAgent = navigator.userAgent.toLowerCase();
    const isElectron = userAgent.indexOf(' electron/') > -1;
    if (isElectron) return 'electron';
    // TODO: add extension runtime
    return 'webapp';
  }
  // TODO: verify this
  nodeRegistry = new Registry<VertexNode>();
  shareHelperRegistry = new Registry<ShareHelper>();
  vertexNodeRegistry = new Registry<VertexNode>();
  @OwnedProperty
  updatePrivsMutex = new AsyncMutex();
  @WeakProperty
  _eventNav?: EventNav;

  setEventNav(eventNav: EventNav) {
    this._eventNav = eventNav;
  }

  get eventNav() {
    const eventNav = this._eventNav;
    if (!eventNav) throw 'eventNav is uninitialized';
    return eventNav;
  }
  setRoute(loc: AppLocation) {
    this.location.set(loc, undefined, undefined, true);
  }

  // Architectural questions:
  // * How do we want to manage and aggregate the necessary subscriptions for the desired Share property records
  // * We need to know about updates to those share properties so we can be aware of the current status.

  getShareHelper(vertex: Model.Vertex): ShareHelper {
    let helper = this.shareHelperRegistry.get(vertex.id)?.upgrade();

    if (!helper) {
      helper = ShareHelper.new(vertex, this);

      this.shareHelperRegistry.add_or_throw(vertex.id, helper, 'sanity error');

      helper.onCleanup(() => {
        this.shareHelperRegistry.remove(vertex.id);
      });
    }
    return helper;
  }
}

function dprChanged(mediaQueryList: MediaQueryListEvent) {
  console.log(
    'Device Pixel Ratio changed to:',
    mediaQueryList.matches ? mediaQueryList.media : window.devicePixelRatio,
  );
  const { innerWidth: w, innerHeight: h, devicePixelRatio: dpr } = window;
  getWasmBindings().get_app_controller().resize(w, h, dpr);
}
