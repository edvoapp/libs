import { JSX, ComponentType } from 'preact';
import cx from 'classnames';

import './skeleton.scss';

interface SkeletonProps {
  count?: number;
  duration?: number;
  width?: number | null;
  wrapper?: ComponentType | null;
  height?: number | null;
  circle?: boolean;
  style?: JSX.CSSProperties;
  className?: string;
}

/**
 * 'Skeleton' is a wrapper around elements that used to take up the space on screen while an element is loading.
 * You can also pass in a wrapper element to "wrap the wrapper", but that is currently unused.
 * */
// TODO: use arg 'props' and initialize in the function (for clarity)
export function Skeleton({
  count = 1,
  duration = 1.2,
  width = null,
  wrapper: Wrapper = null, // not currently being used anywhere so always null
  height = null,
  circle,
  style: customStyle = {},
  className,
}: SkeletonProps) {
  const elements = [];

  for (let i = 0; i < count; i++) {
    let style: JSX.CSSProperties = {};

    if (width !== null) {
      style.width = width;
    }

    if (height !== null) {
      style.height = height;
    }

    if (width !== null && height !== null && circle) {
      style.borderRadius = '50%';
    }

    elements.push(
      <span
        key={i}
        className={cx(className, 'react-loading-skeleton', 'skeleton__root')}
        style={{
          animationDuration: `${duration}s`,
          ...customStyle,
          ...style,
        }}
      >
        &nbsp;
      </span>,
    );
  }

  return (
    <span>
      {/* If a wrapper has been passed, then use it, otherwise just render the elements, */}
      {Wrapper
        ? elements.map((element, i) => (
            <Wrapper key={i}>
              {element}
              &nbsp;
            </Wrapper>
          ))
        : elements}
    </span>
  );
}
