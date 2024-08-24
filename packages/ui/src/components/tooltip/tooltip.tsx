import { createPortal } from 'preact/compat';
import { JSX, ComponentChild } from 'preact';
import { usePopperTooltip, Config, PopperOptions, PropsGetterArgs } from 'react-popper-tooltip';
// import 'react-popper'
import cx from 'classnames';
import 'react-popper-tooltip/dist/styles.css';

import './tooltip.scss';

export interface TooltipProps {
  domRoot?: Document | DocumentFragment;
  usePortal?: boolean;
  tooltipChildren: ComponentChild;
  children: ComponentChild;
  triggerProps?: JSX.HTMLAttributes<HTMLDivElement> & PropsGetterArgs;
  tooltipProps?: JSX.HTMLAttributes<HTMLDivElement> & PropsGetterArgs;
  arrowProps?: JSX.HTMLAttributes<HTMLDivElement> & PropsGetterArgs;
  popperConfig?: Config;
  popperOptions?: PopperOptions;
}

export const Tooltip = ({
  domRoot = document,
  usePortal,
  tooltipChildren,
  children,
  triggerProps = {},
  tooltipProps = {},
  arrowProps = {},
  popperConfig = {},
  popperOptions = {},
}: TooltipProps) => {
  const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible } = usePopperTooltip(
    { delayShow: 500, ...popperConfig, offset: [0, 12] },
    popperOptions,
  );

  const renderTarget = domRoot === document ? document.body : domRoot.getElementById('annotator-root');
  // for now, omit the style
  const { style: tooltipStyle, ...otherTooltipProps } = tooltipProps;
  const { style: arrowStyle, ...otherArrowProps } = arrowProps;

  const tip = (
    <div
      ref={setTooltipRef}
      {...getTooltipProps({
        ...otherTooltipProps,
        className: cx('tooltip', 'tooltip-container', tooltipProps.class as string, tooltipProps.className as string),
      })}
    >
      <div
        {...getArrowProps({
          ...otherArrowProps,
          className: cx('tooltip-arrow', arrowProps.class as string, arrowProps.className as string),
        })}
      />
      {tooltipChildren}
    </div>
  );
  let portal;
  if (renderTarget && usePortal) {
    portal = createPortal(tip, renderTarget);
  }

  return (
    <>
      <div ref={setTriggerRef} {...triggerProps} data-cy="tooltip">
        {children}
      </div>
      {visible && (portal || tip)}
    </>
  );
};
