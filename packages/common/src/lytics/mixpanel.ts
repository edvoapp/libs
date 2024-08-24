import mixpanel from 'mixpanel-browser';
import { intersects } from '../utils';

export type TrackEventParams = {
  category: string;
  action: string;
} & Record<string, any>;

const disabled = intersects(['development', 'test'], [process.env.NODE_ENV]);
// const disabled = false;

export { mixpanel };

mixpanel.init('a3776b93c17b4c2eda8cf5f702d3898d', { debug: true });

export function identify(userID: string) {
  if (disabled) return;
  mixpanel.identify(userID);
}

export function track({ category, ...o }: TrackEventParams) {
  if (disabled) return;
  mixpanel.track(category, o);
}

export type PageViewParams = {
  documentTitle?: string;
  href?: string | Location;
};

export function page(args: PageViewParams) {
  if (disabled) return;
  mixpanel.track('Page View', args);
}
