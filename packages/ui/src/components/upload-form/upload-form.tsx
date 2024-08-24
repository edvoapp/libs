import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { trxWrap } from '@edvoapp/common';
import { FileChooser } from '../index';
import './upload-form.scss';
import { Behaviors } from '../..';
import { useEdvoObj } from '@edvoapp/util';

export const UploadForm = (props: {}) => {
  const [file, setFile] = useState<File | null>(null);
  const uploadHandler = useEdvoObj(() => new Behaviors.Upload(), []);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();

    if (file) {
      const vertex = await trxWrap(async (trx) => {
        return await uploadHandler.uploadFile(trx, file);
      });
      setTimeout(() => route(`/topic/${vertex.id}`), 300);
    }
  };

  const handleChooseFile = (f: File | null) => {
    setFile(f);
  };

  return (
    <form onSubmit={handleSubmit} className="uploadForm">
      <FileChooser
        id="fileChooser"
        // accept={eligibleMimeTypes.join(',')}
        chooseFileCallback={handleChooseFile}
      />
      <input type="submit" value="Upload" disabled={!file} />
    </form>
  );
};
