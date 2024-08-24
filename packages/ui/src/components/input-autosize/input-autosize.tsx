import cx from 'classnames';
import { JSX } from 'preact';
import { forwardRef } from 'preact/compat';
import { useRef } from 'preact/hooks';
import './input-autosize.scss';

export interface InputAutosizeProps extends JSX.HTMLAttributes<HTMLInputElement> {
  maxWidth?: number;
  focused?: boolean;
}

// TODO: delete
export const InputAutosize = forwardRef<HTMLInputElement, InputAutosizeProps>((props, ref) => {
  const inputWrapRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={inputWrapRef}
      className={cx('input-wrap', { focused: props.focused })}
      style={{
        maxWidth: `${props.maxWidth}px`,
      }}
    >
      <span className="input-value">{props.value || props.placeholder}X</span>
      <input ref={ref} {...props} />
    </div>
  );
});
