/**
 * FileChooser — replacement for HTMLInputElement of type `file`.
 *
 * This component is effectively a file input which is styled to not look
 * hilariously ugly.
 *
 * TODO: extend for supporting multiple files.
 * TODO: enable clicking wastebasket icon to remove selected file.
 */

import { useCallback, useState } from 'preact/hooks'; // Approved

import './file-chooser.scss';
import accept = chrome.socket.accept;

const UP_ARROW_EMOJI = '\u2B06\uFE0F';

interface FileChooserProps {
  id: string;
  // TODO: To support multiple, change this to Array<File> or similar.
  chooseFileCallback: (f: File | null) => void;
  // TODO: this isn't actually being used
  accept?: string;
}

export const FileChooser = (props: FileChooserProps) => {
  const { id, chooseFileCallback } = props;
  const [toUpload, setToUpload] = useState<string>('Choose File'); // Approved

  const fileUpdated = useCallback((event: Event) => {
    event.preventDefault();
    const target = event.target as HTMLInputElement;
    const files: FileList = target.files!;
    if (files.length === 0) {
      event.preventDefault();
      setToUpload('Choose File');
      chooseFileCallback(null);
    } else {
      setToUpload(files[0].name);
      chooseFileCallback(files[0]);
      target.files = null; // reset chooser
    }
  }, []);

  return (
    <div className="fileChooserContainer">
      <label for={id}>
        <div className="flex flex-col justify-center items-center">
          <span className="dragDropInstructions">Drag and drop a file anywhere</span>
          <span className="text-gray-500">or</span>
        </div>
        <div className="fileChooserButtons">
          <div className="fileChooserIcon">{UP_ARROW_EMOJI}</div>
          <div className="fileChooserChosenFile">{toUpload}</div>
        </div>
        <input
          type="file"
          className="fileChooser"
          id={id}
          // accept={accept}
          onChange={fileUpdated}
          style={{
            cursor: 'pointer',
          }}
        />
      </label>
    </div>
  );
};
