import { Model, TrxRef, globalStore, trxWrap } from '@edvoapp/common';
import { Annotator } from '../service';
import { Guarded, MemoizeOwned, Observable, ObservableReader, OwnedProperty, tryJsonParse } from '@edvoapp/util';
import { Behavior, CloneContext, DispatchStatus, EventNav } from '..';

// HACK
import { PdfViewRenderer } from '../components/pdf-view/pdf-view';

import * as Bindings from '@edvoapp/wasm-bindings';

import { ConditionalNode, Node, PropertyObsCA, PropertyValueNode } from './base';
// import { UrlBar } from './topic-space';
import * as Behaviors from '../behaviors';
import { UrlPaste } from '../behaviors';
import { PropertyConfig, TextField } from './text-field';
import { UpdatablesSet } from './base/updatables';
import { FileIcon } from './file-icon';
import { MemberBody } from './topic-space';
import { ContentCard } from './topic-space/content-card';

interface CA extends Omit<PropertyObsCA, 'property'> {
  vertex: Model.Vertex;
  readonly?: ObservableReader<boolean>;
}

export const renderableMimeTypes = [
  'text/haml',
  'text/html',
  'text/x-uri',
  'text/x-embed-uri',
  'application/pdf',
  'image/gif',
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/x-icon',
  'image/x-image',
  'text/plain',
];

export const downloadableMimeTypes = [
  'text/html',
  'application/pdf',
  'image/gif',
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/x-icon',
];

// @ts-expect-error TODO: cannot overwrite a parent static class with a different signature
export class BodyContent extends PropertyValueNode<Bindings.ContentState | null | undefined> {
  @OwnedProperty
  vertex: Model.Vertex;
  @OwnedProperty
  readonly?: ObservableReader<boolean>;
  @OwnedProperty
  embedAvailable: Observable<boolean>;
  @OwnedProperty
  fileExtensionProperty: ObservableReader<Model.Property | null | undefined>;
  transparent = true;
  constructor({ vertex, parentNode, readonly }: CA) {
    const contentModeObs = vertex
      .filterProperties({
        role: ['content-mode'],
        contentType: 'text/plain',
        userID: [globalStore.getCurrentUserID()],
      })
      .firstObs()
      .mapObs<string | null | undefined>((p) => (p ? p.text : p));

    const embedAvailable = new Observable(false);

    const property = vertex
      .filterProperties({
        role: ['urlReference', 'body'],
        userID: parentNode.visibleUserIDsForDescendants,
      })
      .chooseObs(
        (list) => {
          let prop;
          const embedProp = list.find((i) => i.contentType.includes('text/x-embed-uri'));
          if (!embedProp) return list[0];
          if (typeof contentModeObs.value === 'undefined') return; // don't return any displayableContent until contentModeObs is loaded (null means loaded, undefined means not loaded yet)
          switch (contentModeObs.value) {
            case 'embed':
              prop = embedProp;
              // This closure can outlive embedAvailable
              // Which might be unavoidable, but this function seems sloppy

              embedAvailable.upgrade()?.set(true);
              break;
            case 'page':
              prop = list.find((i) => i.contentType.includes('text/x-uri'));
              embedAvailable.upgrade()?.set(true);
              break;
            default:
              prop = list[0];
          }
          return prop;
        },
        [contentModeObs],
      );

    super({
      property,
      parentNode,
      valueTransform: (p) => (p ? p.contentState : p),
    });
    this.embedAvailable = embedAvailable;

    this.vertex = vertex;
    this.readonly = readonly;
    this.fileExtensionProperty = vertex
      .filterProperties({
        role: ['file-extension'],
        contentType: 'text/x-file-extension',
        userID: parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  pdfViewComponent?: PdfViewRenderer;

  async getFullText() {
    if (this.pdfViewComponent) {
      return this.pdfViewComponent.getFullText();
    }
    // otherwise return the text/plain content if the contentType is text/plain
    const property = await this.property.get();
    if (property?.contentType === 'text/plain') {
      return property.text.value;
    }
    return null;
  }

  @MemoizeOwned()
  get contentModeObs() {
    return this.vertex
      .filterProperties({
        role: ['content-mode'],
        contentType: 'text/plain',
        userID: [globalStore.getCurrentUserID()],
      })
      .firstObs()
      .mapObs<string | null | undefined>((p) => (p ? p.text : p));
  }

  get childProps(): (keyof this & string)[] {
    return ['textField', 'icon', 'favicon'];
  }

  // TODO - rename this to contentModule and change to ConditionalNode<TextField|Image|Pdf...>
  @MemoizeOwned()
  get textField() {
    return ConditionalNode.new<TextField, Model.Property | null | undefined, BodyContent>({
      parentNode: this,
      precursor: this.property,
      factory: (property, parentNode) => {
        if (property?.contentType !== 'text/plain') return null;
        return TextField.new({
          propertyConfig: PropertyConfig.fromProperty({ property }),
          parentNode,
          fitContentParent: this.parentNode,
          readonly: this.readonly,
        });
      },
    });
  }
  // TODO: consider consolidating this with TopicItem's icon
  @MemoizeOwned()
  get icon() {
    const precursor = this.property.mapObs((p) => {
      const contentType = p?.contentType;
      if (!contentType) return false;
      return !renderableMimeTypes.includes(contentType);
    });
    return ConditionalNode.new<FileIcon, boolean, Node>({
      parentNode: this,
      precursor,
      factory: (pre, parentNode) =>
        pre
          ? FileIcon.new({
              parentNode,
              property: this.property,
              fileExtensionProperty: this.fileExtensionProperty,
            })
          : null,
    });
  }

  @OwnedProperty
  missingExt = this.context.extBridge!.extensionStatus.mapObs((x) => x === 'NOT_INJECTED') ?? null;

  @MemoizeOwned()
  get favicon() {
    const faviconProperty = this.vertex
      .filterProperties({
        role: ['favicon'],
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();

    return FileIcon.new({
      parentNode: this,
      property: this.property,
      fileExtensionProperty: this.fileExtensionProperty,
      faviconProperty,
      cursor: this.cursor,
    });
  }

  doLayout() {
    this.textField.doLayout();
  }

  getLocalBehaviors(): Behavior[] {
    return [new SelectionBehavior()];
  }

  static new(args: CA) {
    const me = new BodyContent(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get highlightManager() {
    return new Annotator.HighlightManager({
      entity: new Observable<Model.Vertex | null>(this.vertex),
      node: this,
    });
  }

  get isVisible() {
    return !!this.property.value;
  }

  createImageCapture(content: string) {
    void trxWrap(async (trx: TrxRef) => {
      await this.vertex.upsertProperty({
        contentType: 'image/jpeg',
        initialString: content,
        role: ['image-capture'],
        trx,
      });
    });
  }
  get focusable(): boolean {
    // Skip over this OutlineItem when walking via {downward,upward,leftward,rightward}Node in cases where the starting node is our own BodyContent or any of it's children
    // if (this.contains(originNode)) return false;
    const computedAppearance = this.computedAppearance.value;
    // Body content can only be focus target if it is a browser or subspace
    // otherwise, a text field will get the focus.
    const focusables = ['browser', 'subspace'];
    return focusables.includes(computedAppearance?.type ?? '');
  }
  get imageCaptureProperty() {
    return this.vertex
      .filterProperties({
        role: ['image-capture'],
        contentType: 'image/jpeg',
        userID: [globalStore.getCurrentUserID()],
      })
      .firstObs()
      .mapObs<string | null | undefined>((prop) => prop && prop.content);
  }

  async setContentMode(mode: string) {
    const contentModeProp = await this.vertex
      .filterProperties({
        role: ['content-mode'],
        contentType: 'text/plain',
        userID: [globalStore.getCurrentUserID()],
      })
      .firstObs()
      .get();

    const isCurrent = contentModeProp?.text.value === mode;

    if (isCurrent) return;

    void trxWrap(async (trx: TrxRef) => {
      if (contentModeProp) {
        return contentModeProp.setContent(trx, mode);
      }

      return this.vertex.createProperty({
        trx,
        role: ['content-mode'],
        contentType: 'text/plain',
        initialString: mode,
      });
    });
  }

  @MemoizeOwned()
  get embedProp() {
    return this.vertex
      .filterProperties({
        role: ['body'],
        contentType: 'text/x-embed-uri',
      })
      .firstObs();
  }

  @MemoizeOwned()
  get urlProp() {
    return this.vertex
      .filterProperties({
        role: ['body'],
        contentType: 'text/x-uri',
      })
      .firstObs();
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.property, this.appearanceProperty, this.embedProp, this.urlProp]);
  }
  @MemoizeOwned()
  get appearanceProperty(): ObservableReader<Model.Property | null | undefined> {
    return this.vertex
      .filterProperties({
        role: ['appearance'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get appearance() {
    return this.appearanceProperty.mapObs<Behaviors.MemberAppearance | undefined>((p) => {
      // Formatted for your reading pleasure o/
      if (typeof p === 'undefined') return undefined;
      if (!p) return {};

      return p.text.mapObs((c) => tryJsonParse<Behaviors.MemberAppearance>(c));
    });
  }

  @MemoizeOwned()
  get computedAppearance() {
    const memberBody = this.findClosest((n) => n instanceof MemberBody && n);
    // HACK: this should probably be smarter, but it's not "worse"
    const contentCard = this.closestInstance(ContentCard);
    if (contentCard) return new Observable({ type: 'browser' });
    return memberBody?.appearance || new Observable({ type: 'normal' });
  }

  @MemoizeOwned()
  get url() {
    const GOOGLE_SEARCH = 'https://www.google.com/search?q=';

    return this.property.mapObs<string | null>(
      (property) =>
        property?.text.mapObs((inputUrl) => {
          if (!inputUrl) return null;
          return UrlPaste.urlTidy(inputUrl)?.toString() ?? encodeURI(`${GOOGLE_SEARCH}${inputUrl}`);
        }) ?? null,
    );
  }

  /**
   * overwriting PropertyValueNode.shallowClone because we want to ensure we clone the appearance property, AND we want to traverse this tree
   */
  @Guarded
  async shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    await Promise.all(
      [this.appearanceProperty, this.embedProp, this.urlProp].map(async (p) => {
        const prop = await p.get();
        if (prop) cloneContext.cloneProperty(targetParentVertex, prop);
      }),
    );
    // clone the text property; if lozenges within the text prop need to be cloned, then they will overwrite the content
    await super.shallowClone(targetParentVertex, cloneContext);
    return targetParentVertex;
  }

  get simplifiedContent(): SimplifiedContent {
    const property = this.property.value;
    if (!property) return { text: '' };

    const contentType = property.contentType;
    if (contentType === 'text/plain') {
      return { text: property.contentState.value?.to_lossy_string() ?? '' };
    }
    if (contentType === 'text/x-uri' || contentType === 'text/x-embed-uri') {
      return { url: property.contentState.value?.to_lossy_string() ?? '' };
    }
    return { text: '' };
  }
}

export type SimplifiedContent = { text: string } | { url: string } | { outline: string };

export class SelectionBehavior extends Behavior {
  selecting = false;
  handleMouseMove(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const node = originNode.findClosest((x) => x instanceof BodyContent && x);
    if (e.buttons !== 1 || node?.property.value?.contentType !== 'application/pdf') {
      return 'decline';
    }
    if (!this.selecting) {
      this.selecting = true;
      eventNav.setGlobalBehaviorOverrides(this, ['handleMouseMove', 'handleMouseUp']);
    }
    return 'native';
  }
  handleMouseUp(eventNav: EventNav, e: MouseEvent, node: Node): DispatchStatus {
    if (!this.selecting) return 'decline';
    this.selecting = false;
    eventNav.unsetGlobalBehaviorOverrides(this);
    return 'native';
  }
}
