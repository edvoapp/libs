import { useState, useEffect, useRef } from 'preact/hooks'; // Approved
import cx from 'classnames';

import { autoSize } from '../../utils';
import css from './note-form.module.css';

/**
 * Props for the NoteForm component.
 */
interface NoteFormProps {
  /**
   * A short header to display at the top of the note form.
   */
  header: string;

  /**
   * The text of the submit button. The default is "Save".
   */
  submitText?: string;

  /**
   * The text of the submit button when the note is being submitted. Default is
   * "Saving...".
   */
  submittingText?: string;

  /**
   * Text to display if the note was submitted successfully. Default is "Success!".
   */
  successText?: string;

  /**
   * Checked for falsiness; if the value is true on mount, the note form is in focus and
   * selected for editing. Any change in value for this prop will cause it to be
   * re-focused as long as it is not falsy. The value itself doesn't matter.
   */
  focus?: number;

  /**
   * What to do when the user submits the note for saving. If the resolved object has an
   * error property, the note form will go into an error state instead of resetting.
   */
  onSubmit(body: string): {
    error: string | null;
  };
}

/**
 * Form component for recording notes. Simple text area with a save button, and maybe some
 * other doodads down the road.
 *
 * TODO: Rich text editing
 */
export function NoteForm(props: NoteFormProps) {
  // ANCHOR: State
  const [body, setBody] = useState(''); // Approved
  const [submitting, setSubmitting] = useState(false); // Approved
  const [success, setSuccess] = useState(false); // Approved
  const [error, setError] = useState(''); // Approved
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ANCHOR: Autosizing
  useEffect(() => {
    if (bodyRef.current) {
      autoSize(bodyRef.current);
    }
  }, [body]);

  // ANCHOR: syncBody
  const syncBody = (event: any) => {
    const target = event.target as HTMLTextAreaElement;
    setBody(target.value);
  };

  // ANCHOR: submit
  const submit = async (event?: Event) => {
    event?.preventDefault();
    setSubmitting(true);
    setError('');
    const result = props.onSubmit(body);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setBody('');
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    }
    setSubmitting(false);
  };

  return (
    <label // ANCHOR: jsx - noteForm
      className={css.noteForm}
    >
      <header // ANCHOR: jsx - header
        className={css.header}
      >
        {props.header}
      </header>
      <textarea // ANCHOR: jsx - body
        className={css.body}
        ref={bodyRef}
        value={body}
        disabled={submitting}
        onInput={syncBody}
      ></textarea>
      <div // ANCHOR: jsx - bottomRow
        className={css.bottomRow}
      >
        <div // ANCHOR: jsx - error
          className={css.error}
        >
          {error}
        </div>
        <div // ANCHOR: jsx - success
          className={cx(css.success, !success && css.flagHidden)}
        >
          {props.successText || 'Success!'}
        </div>
        <button // ANCHOR: jsx - submit
          className={cx(css.submit, !body && css.flagHidden)}
          disabled={submitting || !body}
          onClick={submit}
        >
          {(submitting && (props.submittingText || 'Saving...')) ||
            // This next line prevents a sudden shift in text in the button
            // before it fades out
            (success && (props.submittingText || 'Saving...')) ||
            props.submitText ||
            'Save'}
        </button>
      </div>
    </label>
  );
}
