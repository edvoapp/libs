import { config, intersects } from '../utils';
import GA from 'react-ga4';
import * as amplitude from '@amplitude/analytics-browser';
import mixpanel from 'mixpanel-browser';

export const MEASUREMENT_ID = 'G-XNP6R4H3V3';
const AMPLITUDE_API_KEY = '6e35f4d32107a4c8bcf7403b9904732e';
const MIXPANEL_API_KEY = 'a3776b93c17b4c2eda8cf5f702d3898d';

const env = config.env;
const disabled = intersects(
  [
    'development',
    'test',
    // 'nightly',
  ],
  [env],
);

function tryCatch<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (err) {
    console.error('err', err);
    return null;
  }
}

export function init() {
  tryCatch(() => {
    if (disabled || typeof window === 'undefined') return;
    GA?.initialize(MEASUREMENT_ID);
    amplitude.init(AMPLITUDE_API_KEY, undefined, {
      defaultTracking: {
        pageViews: true,
        sessions: true,
        formInteractions: true,
        fileDownloads: true,
      },
    });
    mixpanel.init(MIXPANEL_API_KEY, {
      debug: true,
      //@ts-ignore
      track_pageview: true,
      persistence: 'localStorage',
    });
  });
}

export function identify(user_id: string) {
  tryCatch(() => {
    if (disabled || typeof window === 'undefined') return;
    GA?.gtag('config', MEASUREMENT_ID, { user_id, env });
    amplitude.setUserId(user_id);
    mixpanel.identify(user_id);
  });
}

export function identifyUser(args: { name?: string | null; email?: string | null }) {
  tryCatch(() => {
    if (disabled || typeof window === 'undefined') return;
    const identifyEvent = new amplitude.Identify();
    for (const [key, val] of Object.entries(args)) {
      if (val) identifyEvent.set(key, val);
    }
    amplitude.identify(identifyEvent);
  });
}

export function reset() {
  tryCatch(() => {
    if (disabled || typeof window === 'undefined') return;
    amplitude.reset();
    // mixpanel.reset(); // for some reason this throws errors in test suite
  });
}

export function page(params = {}) {
  tryCatch(() => {
    if (disabled || typeof window === 'undefined') return;
    const currentPage = location.pathname + location.search;
    GA?.gtag('page_view', {
      page_location: currentPage,
      user_agent: window.navigator.userAgent,
      env,
      ...params,
    });
    amplitude.track({
      event_type: 'page_view',
      event_properties: {
        page_location: currentPage,
        user_agent: window.navigator.userAgent,
        env,
        ...params,
      },
    });
    mixpanel.track('page_view', {
      page_location: currentPage,
      user_agent: window.navigator.userAgent,
      env,
      ...params,
    });
  });
}

export function event(action: string, params = {}) {
  tryCatch(() => {
    if (disabled || typeof window === 'undefined') return;
    GA?.gtag('event', action, { ...params, env });
    amplitude.track({
      event_type: action,
      event_properties: { ...params, env },
    });
    mixpanel.track(action, { ...params, env });
  });
}
