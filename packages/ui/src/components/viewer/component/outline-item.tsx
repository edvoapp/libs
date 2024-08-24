import cx from 'classnames';
import { useCallback, useContext, useMemo, useRef, useEffect } from 'preact/hooks'; // Approved

import { Model } from '@edvoapp/common';
import { useEdvoObj, useObserveValue, useObserveValueMaybe } from '@edvoapp/util';

import * as VM from '../../../viewmodel';

import { SharingStatus } from '../../sharing-status';
import '../viewer.scss';

import { BodyContent } from '../../..';
import { CheckboxChecked, CheckboxUnchecked } from '../../../assets';
import { useSharedBranchNode } from '../../../hooks/useSharedState';

export interface OutlineItemComponentProps {
  node: VM.OutlineItem;
  backref?: Model.Backref;
  readonly?: boolean;
  shadowParent?: Model.Vertex; // This needs a better name - it's both a flag to say "you're unshadowed" and also the parent of the parent user vertex
  omitBody?: boolean;
}

export function OutlineItem({ node, backref, omitBody }: OutlineItemComponentProps) {
  const bodyNode = node.contentBody;

  const appearance = useObserveValue(() => node.appearance, [node]);

  const hasAction = useObserveValue(() => node.hasAction, [node]);
  const visible = useObserveValue(() => node.visible, [node]);

  const isChecked = useObserveValue(() => node.checkStatus, [node]);

  // save a render cycle if we're starting out focused
  const isFocused = useObserveValue(() => node.isFocused, [node]);
  const isSelected = useObserveValue(() => node.isSelected, [node]);

  const isIndicated = useObserveValue(() => node.indicated, [node]);

  const meta = useObserveValue(() => node.backref.meta, [node]);
  const readonly = !useObserveValueMaybe(() => backref?.editable, [backref]);
  const ref = useRef<HTMLDivElement | null>();

  const { sharedCx } = useSharedBranchNode(node);

  const appearanceType = appearance?.type ?? 'bullet';
  const wrapperCx = useMemo(() => {
    // Approved
    return cx(
      'focusable',
      `vertex-component`,
      `outline-item`,
      { readonly },
      meta?.customClass,
      appearanceType === 'checkbox' && [
        'outline-item__plain',
        isChecked ? 'outline-item__checked' : 'outline-item__unchecked',
      ],
      hasAction && 'has-action',
      appearanceType === 'plain' && 'outline-item__plain',
      `appearance-${appearanceType}`,
      // OVERRIDES
      // outline-item__plain <-- no bullet
      // outline-item__checked <-- checkbox
      // outline-item__unchecked <--
      isFocused && 'is-active focused',
      isSelected && 'selected',
      isIndicated.drag && 'indicated',
    );
  }, [node, isFocused, isSelected, meta, appearanceType, isChecked, hasAction, isIndicated]);

  const childrenNodes = useObserveValue(() => node.items, [node]);

  const out = childrenNodes.map((child, i) => (
    <OutlineItem key={`${child.vertex.id}_${i}`} node={child} backref={child.backref} />
  ));

  // HACK - store a copy so safeBindDomElement can be called on object cleanup
  const handle = useEdvoObj(() => node.handle, [node]);

  // const zIndex = useObserveValue(() => node.zIndex, [node]);
  if (typeof appearance === 'undefined' || !visible) return null;

  return (
    <>
      <div
        id={'vertex__' + node.vertex.id}
        className={wrapperCx}
        ref={(r: HTMLDivElement | null) => {
          ref.current = r;
          node.safeBindDomElement(r);
        }}
      >
        {!omitBody && (
          <div className={cx('main', sharedCx)}>
            <div className="controls" ref={(r: HTMLElement | null) => handle.safeBindDomElement(r)}>
              <div className="handle" />
              {/* {vertex.id?.substr(0, 4)} */}
              {/* TODO: create a VM Checkbox */}
              <input
                type="checkbox"
                id={`checkbox-${node.vertex.id}`}
                className="checkbox"
                checked={!!isChecked}
                onChange={() => node.toggleCheck()}
              />
              <label htmlFor={`checkbox-${node.vertex.id}`} className="checkbox-label">
                <CheckboxChecked width="20" height="20" className={'checkbox-checked'} />
                <CheckboxUnchecked width="20" height="20" className={'checkbox-unchecked'} />
              </label>
            </div>
            <BodyContent node={bodyNode} />
            <SharingStatus {...{ vertex: node.vertex }} />
          </div>
        )}
        {!!out?.length && <div className={'relation-category'}>{out}</div>}
      </div>
    </>
  );
}
