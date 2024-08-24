import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { Model, globalStore } from '@edvoapp/common';
import * as VM from '../viewmodel';
import { uiParams } from '..';
import cx from 'classnames';
import { useRef } from 'preact/hooks';

export function useSharedBranchNode(node: VM.BranchNode): {
  sharedCx: string;
  shared?: boolean;
  changed?: boolean;
} {
  return useSharedBackref(node.backref);
}

export function useSharedBackref(backref: Model.Backref): {
  sharedCx: string;
  shared?: boolean;
  changed?: boolean;
} {
  const last = useRef<boolean>();
  const changed = useRef<boolean>();
  const recipients = useObserveValueMaybe(() => backref.privs, [backref])?.recipientID ?? [];

  const reveal = useObserveValue<boolean>(() => uiParams.revealShares, [uiParams], 'reveal-shares');
  if (!reveal) return { sharedCx: '' };

  const userID = globalStore.getCurrentUserID();
  const shared = recipients.filter((r) => r != userID).length > 0;

  last.current ??= shared;

  if (shared != last.current) {
    changed.current = true;
  }
  const sharedCx = cx('shareableBackref', { shared, changed: changed.current });

  return { sharedCx, shared, changed: changed.current };
}

export function useSharedEdge(edge: Model.Edge): {
  sharedCx: string;
  shared?: boolean;
  changed?: boolean;
} {
  const last = useRef<boolean>();
  const changed = useRef<boolean>();
  const recipients = useObserveValueMaybe(() => edge.privs, [edge])?.recipientID ?? [];

  const reveal = useObserveValue<boolean>(() => uiParams.revealShares, [uiParams]);
  if (!reveal) return { sharedCx: '' };

  const userID = globalStore.getCurrentUserID();
  const shared = recipients.filter((r) => r != userID).length > 0;

  last.current ??= shared;

  if (shared != last.current) {
    changed.current = true;
  }
  const sharedCx = cx('shareableEdge', { shared, changed: changed.current });

  return { sharedCx, shared, changed: changed.current };
}

export function useSharedProperty(property: Model.Property | null | undefined): {
  sharedCx: string;
  shared?: boolean;
  changed?: boolean;
} {
  const last = useRef<boolean>();
  const changed = useRef<boolean>();

  const recipients = useObserveValueMaybe(() => property?.privs, [property])?.recipientID || [];

  const reveal = useObserveValue<boolean>(() => uiParams.revealShares, [uiParams], 'reveal-shares');
  if (!reveal || !property) return { sharedCx: '' };

  const userID = globalStore.getCurrentUserID();
  const shared = recipients.filter((r) => r != userID).length > 0;

  last.current ??= shared;

  if (shared != last.current) {
    changed.current = true;
  }
  const sharedCx = cx('shareableProperty', {
    shared,
    changed: changed.current,
  });
  return { sharedCx, shared, changed: changed.current };
}
