import { h } from 'preact';
import { useRef } from 'preact/hooks';

import css from './toggle.module.css';

/**
 * Props for the toggle component.
 */
interface ToggleProps {
  /**
   * Whether or not the toggle is active.
   */
  checked: boolean;

  /**
   * What to do when the toggle is clicked.
   */
  onClick: () => void;
}

/**
 * Run of the mill toggle component. Looks like one of those green or gray switches in the
 * settings on your phone.
 */
// TODO: deletes
export function Toggle(props: ToggleProps) {
  return (
    <label // ANCHOR: jsx - toggle
      className={css.toggle}
    >
      <input // ANCHOR: jsx - checkbox
        className={css.checkbox}
        type="checkbox"
        checked={props.checked}
      />
      <button // ANCHOR: jsx - tictac
        className={css.tictac}
      >
        <div // ANCHOR: jsx - puck
          className={css.puck}
        ></div>
      </button>
    </label>
  );
}
