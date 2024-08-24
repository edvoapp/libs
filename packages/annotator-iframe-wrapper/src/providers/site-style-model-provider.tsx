import debounce from 'lodash/debounce';
import { createContext, FunctionComponent, h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { publishMessageToInner, useSubscribeOnMount } from '../hooks/pubsub';
import { getAbsoluteClientRect } from '../util/dom/utils';
import { useProvider } from './common';
import { getExistingMargin, SIDEBAR_WIDTH, useMode } from './mode-provider';

// TODO: get these interfaces from common
interface CssSelector {
  cssSelector: string;
  parentSteps: number;
}

interface LeftRightRegionSelector {
  page: CssSelector & {
    contentAreas: CssSelector[];
  };
}

interface NegativeRegionSelector {}

type LeftRightPaintableRegionDataDB = {
  type: 'left-right';
  selectors: LeftRightRegionSelector[];
};

type NegativePaintableRegionDataDB = {
  type: 'negative';
  selectors: NegativeRegionSelector[];
};

type PaintableRegionDataDB = {
  name: string;
} & (LeftRightPaintableRegionDataDB | NegativePaintableRegionDataDB);

interface PageMatchingCriteria {
  name: string;
  type: 'meta';
  value: string;
}

interface MatchingCriteria {
  AND?: PageMatchingCriteria[];
  OR?: PageMatchingCriteria[];
}

interface SiteStyleModelDB {
  id: string;
  paintableRegions: PaintableRegionDataDB[];
  name: string;
  matchingCriteria: MatchingCriteria;
}

export interface ContentRegion {
  contentAreaIndex: number;
  contentAreaRect: DOMRectReadOnly;
  paintableRect: DOMRectReadOnly;
  contentAreaElt: HTMLElement;
}

type Region = Omit<ContentRegion, 'contentAreaElt'>;

type Regionator = {
  regions: Region[];
  paintableRegions: ContentRegion[];
};

function getSidebarOpen() {
  return document.body.classList.contains('edvo__sidebar-open');
}

function getOrAddMargin(contentAreaElt: HTMLElement, pageRect: DOMRect) {
  let contentAreaRect = getAbsoluteClientRect(contentAreaElt);

  // this will all be relative to the top-left of the PAGE (not the viewport)
  // we should figure out what the "sweet spot" is, I think having a max of 5 (140 / 40) hops is fine, and 40 px is not that huge of a margin
  const HOP_SIZE = 40;
  const MARGIN_WIDTH = 140;
  let rightRegionWidth = pageRect.right - contentAreaRect.right;
  let rightRegionTooSmall = rightRegionWidth < MARGIN_WIDTH;
  let hops = 0;
  console.log('pageRect!', pageRect);
  while (hops < 10 && rightRegionTooSmall) {
    const { marginRight: currentRightMargin } = getExistingMargin(contentAreaElt);
    if (rightRegionTooSmall) {
      contentAreaElt.style.marginRight = `${currentRightMargin + HOP_SIZE}px`;
    }
    contentAreaRect = getAbsoluteClientRect(contentAreaElt);
    rightRegionWidth = pageRect.right - contentAreaRect.right;
    rightRegionTooSmall = rightRegionWidth < MARGIN_WIDTH;
    hops++;
  }

  if (hops >= 10) {
    console.warn(`Took at least ${hops} hops to normalize. right width: ${rightRegionWidth}`);
  }

  const sidebarOpen = getSidebarOpen();

  const normalizedContentRect = new DOMRectReadOnly(
    contentAreaRect.left + (sidebarOpen ? SIDEBAR_WIDTH : 0),
    contentAreaRect.top,
    contentAreaRect.width,
    contentAreaRect.height,
  );

  const rightRegion = new DOMRectReadOnly(
    normalizedContentRect.right,
    normalizedContentRect.top,
    rightRegionWidth,
    normalizedContentRect.height,
  );
  return { contentAreaRect: normalizedContentRect, rightRegion };
}

function createRegionRect(contentAreaElt: HTMLElement, pageRect: DOMRectReadOnly) {
  const { contentAreaRect, rightRegion } = getOrAddMargin(contentAreaElt, pageRect);
  const paintableRect = rightRegion;
  return { contentAreaRect, paintableRect };
}

function getDomRegions(selector: LeftRightRegionSelector | NegativeRegionSelector): ContentRegion[] {
  if (!('page' in selector)) {
    return [];
  }
  const {
    page: { contentAreas, cssSelector, parentSteps },
  } = selector;
  const pageRegionElts = document.querySelectorAll(cssSelector);
  const regions: ContentRegion[] = [];
  pageRegionElts.forEach((pageEl) => {
    let pageRegionElt = pageEl;
    let idx = parentSteps;
    while (idx !== 0) {
      if (pageRegionElt.parentElement) {
        pageRegionElt = pageRegionElt.parentElement;
        idx--;
      }
    }

    const pageRect = getAbsoluteClientRect(pageRegionElt);
    contentAreas.forEach(
      ({ cssSelector: contentAreaSelector, parentSteps: contentAreaParentSteps }, contentAreaIndex) => {
        const contentAreaEls = pageRegionElt.querySelectorAll<HTMLElement>(`:scope ${contentAreaSelector}`);
        contentAreaEls.forEach((contentAreaEl, contentAreaElIndex) => {
          let contentAreaElt = contentAreaEl;
          let jdx = contentAreaParentSteps;
          while (jdx !== 0) {
            if (contentAreaElt.parentElement) {
              contentAreaElt = contentAreaElt.parentElement;
              jdx--;
            }
          }
          const region = createRegionRect(contentAreaElt, pageRect);
          regions.push({
            contentAreaIndex,
            contentAreaElt,
            ...region,
          });
        });
      },
    );
  });
  return regions;
}

function unpaintRegions() {
  document.body.style.marginLeft = `initial`;
  document.body.style.marginRight = `initial`;
  document.body.style.position = 'initial';
  document.querySelectorAll('.edvo__highlighted').forEach((e) => e.classList.add('inactive'));
}

interface SiteStyleModelParams {
  paintableRegions: {
    contentAreaIndex: number;
    contentAreaRect: DOMRectReadOnly;
    paintableRect: DOMRectReadOnly;
    contentAreaElt: HTMLElement;
  }[];
}

const SiteStyleModelContext = createContext<SiteStyleModelParams | null>(null);

export function getMeta(metaName: string, metas = document.getElementsByTagName('meta')): string | null {
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if ([meta.getAttribute('name'), meta.getAttribute('property')].includes(metaName)) {
      return meta.getAttribute('content');
    }
  }

  return null;
}

export function matchCriteria(
  { name, type, value }: PageMatchingCriteria,
  metas = document.getElementsByTagName('meta'),
): boolean {
  switch (type) {
    case 'meta':
      return getMeta(name, metas) === value;
    default:
      console.log('not supported');
      return false;
  }
}

export function matchModel(
  styleModels: SiteStyleModelDB[],
  metas = document.getElementsByTagName('meta'),
): SiteStyleModelDB | null {
  for (const styleModel of styleModels) {
    const {
      matchingCriteria: { AND, OR },
    } = styleModel;
    if (
      (AND && AND.every((criteria) => matchCriteria(criteria, metas))) ||
      (OR && OR.some((criteria) => matchCriteria(criteria, metas)))
    ) {
      return styleModel;
    }
  }
  return null;
}

const PAINTABLE_AREA_SIZE = 140;

function createDefaultPaintableRegions(): Regionator {
  // add some default margins
  const { marginRight } = getExistingMargin(document.body);
  const sidebarOpen = getSidebarOpen();
  const r = Math.min(marginRight + PAINTABLE_AREA_SIZE, PAINTABLE_AREA_SIZE);
  document.body.style.marginRight = `${r}px`;
  document.body.style.position = 'relative';
  document.querySelectorAll('.edvo__highlighted').forEach((el) => el.classList.remove('inactive'));
  const { scrollHeight } = document.body;
  const contentAreaRect = new DOMRectReadOnly(sidebarOpen ? SIDEBAR_WIDTH : 0, 0, window.innerWidth - r, scrollHeight);
  const paintableRect = new DOMRectReadOnly(window.innerWidth - r, 0, PAINTABLE_AREA_SIZE, scrollHeight);

  // TODO: figure out if the content area rect should just document.body's content area rect... but sometimes document.body isn't tall enough
  // const contentAreaRect = document.body.getBoundingClientRect();
  // const { left: clientLeft, right: clientRight, top } = contentAreaRect;
  // const paintableRects = [
  //   new DOMRectReadOnly(clientLeft, top, PAINTABLE_AREA_SIZE, window.innerHeight),
  //   new DOMRectReadOnly(clientRight, top, PAINTABLE_AREA_SIZE, window.innerHeight),
  // ];

  const region: Region = {
    contentAreaIndex: 0,
    contentAreaRect,
    paintableRect,
  };
  const paintableRegion: ContentRegion = {
    ...region,
    contentAreaElt: document.body,
  };
  const regions = [region];
  const paintableRegions = [paintableRegion];
  return { regions, paintableRegions };
}

function squish(squishFactor: number, leftWidth: number, rightWidth: number) {
  const neededWidth = leftWidth + rightWidth;
  const viewportWidth = window.innerWidth;
  const scaleX = 1 - (neededWidth * squishFactor) / viewportWidth;
  const scaleY = (squishFactor + scaleX) / (1 + squishFactor);
  console.log('scaleX:', scaleX, 'scaleY:', scaleY);
  const descaleX = 1 / scaleX;
  const unsquishedX = neededWidth - (1 - scaleX) * viewportWidth;
  Object.assign(document.body.style, {
    'transform-origin': 'left top',
    transform: `scale(${scaleX}, ${scaleY}) translateX(${leftWidth * descaleX}px)`,
    'margin-right': `${unsquishedX * descaleX}px`,
  });
}

function createSquishedPaintableRegions(leftWidth: number, rightWidth: number): Regionator {
  const squishFactor = 1 - (Math.max(window.innerWidth, 900) - 900) / 900;
  console.log('squishFactor!', squishFactor);
  squish(squishFactor, leftWidth, rightWidth);

  const sidebarOpen = getSidebarOpen();
  document.querySelectorAll('.edvo__highlighted').forEach((el) => el.classList.remove('inactive'));
  const { scrollHeight } = document.body;
  const contentAreaRect = new DOMRectReadOnly(
    sidebarOpen ? SIDEBAR_WIDTH : 0,
    0,
    window.innerWidth - PAINTABLE_AREA_SIZE - SIDEBAR_WIDTH,
    scrollHeight,
  );
  const paintableRect = new DOMRectReadOnly(
    window.innerWidth - PAINTABLE_AREA_SIZE,
    0,
    PAINTABLE_AREA_SIZE,
    scrollHeight,
  );

  const region: Region = {
    contentAreaIndex: 0,
    contentAreaRect,
    paintableRect,
  };
  const paintableRegion: ContentRegion = {
    ...region,
    contentAreaElt: document.body,
  };
  const regions = [region];
  const paintableRegions = [paintableRegion];
  return { regions, paintableRegions };
}

function createPaintableRegionsForReader(): Regionator | null {
  // document.getElementById('edvo__reader-body')
  const container = document.getElementById('edvo__reader-container');
  if (!container) return null;
  const pageRect = new DOMRectReadOnly(0, 0, window.innerWidth, document.body.clientHeight);
  const region = createRegionRect(container, pageRect);
  const domRegion = {
    contentAreaIndex: 0,
    contentAreaElt: container,
    ...region,
  };
  // can't send HTML elements across the wire
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contentAreaElt, ...rest } = domRegion;
  const regions = [rest];
  const paintableRegions = [domRegion];
  return { regions, paintableRegions };
}

export const SiteStyleModelProvider: FunctionComponent = ({ children }) => {
  const { mode } = useMode();
  // undefined indicates that we have not made the query yet
  const [styleModel, setStyleModel] = useState<SiteStyleModelDB | null | undefined>(undefined);
  const [paintableRegions, setPaintableRegions] = useState<ContentRegion[]>([]);

  const computeStyleModel = useCallback(
    debounce(() => {
      const scroll = { x: window.scrollX, y: window.scrollY };
      const regionator = createSquishedPaintableRegions(mode === 'ACTIVE' ? SIDEBAR_WIDTH : 0, PAINTABLE_AREA_SIZE);
      setPaintableRegions(regionator.paintableRegions);
      publishMessageToInner('PAINTABLE_REGIONS_SUCCESS', {
        regions: regionator.regions,
        scroll,
      });
      // const readerRegions = createPaintableRegionsForReader();
      // if (mode === 'INACTIVE') {
      //   unpaintRegions();
      // } else if (readerRegions) {
      //   // do something
      //   setPaintableRegions(readerRegions.paintableRegions);
      //   publishMessageToInner('PAINTABLE_REGIONS_SUCCESS', { regions: readerRegions.regions, scroll });
      // } else if (styleModel) {
      //   const { paintableRegions } = styleModel;
      //   const [paintableRegion] = paintableRegions;
      //   switch (paintableRegion.type) {
      //     case 'left-right': {
      //       // locally
      //       const regions: Region[] = [];
      //       const pRegions: ContentRegion[] = [];
      //       paintableRegion.selectors.forEach(selector => {
      //         const domRegions = getDomRegions(selector);
      //         domRegions.forEach(domRegion => {
      //           // can't send HTML elements across the wire
      //           // eslint-disable-next-line @typescript-eslint/no-unused-vars
      //           const { contentAreaElt, ...rest } = domRegion;
      //           regions.push(rest);
      //           pRegions.push(domRegion);
      //         });
      //       });
      //       setPaintableRegions(pRegions);
      //       publishMessageToInner('PAINTABLE_REGIONS_SUCCESS', { regions, scroll });
      //       break;
      //     }
      //     default: {
      //       console.warn(`Type ${paintableRegion.type} not supported`);
      //       const regionator = createDefaultPaintableRegions();
      //       setPaintableRegions(regionator.paintableRegions);
      //       publishMessageToInner('PAINTABLE_REGIONS_SUCCESS', { regions: regionator.regions, scroll });
      //       break;
      //     }
      //   }
      // } else if (styleModel === null) {
      //   const regionator = createDefaultPaintableRegions();
      //   setPaintableRegions(regionator.paintableRegions);
      //   publishMessageToInner('PAINTABLE_REGIONS_SUCCESS', { regions: regionator.regions, scroll });
      // }
    }, 500),
    [mode, styleModel, setPaintableRegions],
  );

  useSubscribeOnMount<{ styleModels: SiteStyleModelDB[] }>('SITE_STYLE_MODEL', ({ styleModels }) => {
    const metas = document.getElementsByTagName('meta');
    const model = matchModel(styleModels, metas);
    setStyleModel(model);
  });

  // useDebounce(computeStyleModel, 1000, [computeStyleModel]);

  useEffect(() => {
    computeStyleModel();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', computeStyleModel);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', computeStyleModel);
      }
    };
  }, [computeStyleModel]);

  return <SiteStyleModelContext.Provider value={{ paintableRegions }}>{children}</SiteStyleModelContext.Provider>;
};

export const useSiteStyleModel = () => useProvider(SiteStyleModelContext, 'siteStyleModel');
