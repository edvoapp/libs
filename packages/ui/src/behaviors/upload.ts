import { Model, TrxRef, DB, globalStore } from '@edvoapp/common';

import { Behavior } from '../service';
import { ToastService, POSITION, TYPE } from '../service/toast';

type ToastRef = { id: string | number | null };

export class Upload extends Behavior {
  private toast: ToastService = new ToastService();

  async uploadFile(trx: TrxRef, file: File) {
    console.log('file', file);
    const arrayBuffer = await file.arrayBuffer();
    const sha = await Model.Property.createArrayBufferHash(arrayBuffer);
    return Model.Vertex.upsert({
      trx,
      parent: null,
      name: file.name,
      kind: 'resource',
      attributes: { url: `${file.name}:${sha}`.substring(0, 200) },
      onCreate: (trx: TrxRef, vertex: Model.Vertex) => {
        const toastRef: ToastRef = { id: null };
        void trx.addOp(vertex, async (trx: TrxRef) => {
          await Model.Property.createAsync({
            trx,
            sha,
            role: ['body'],
            parent: vertex,
            contentHandle: file,
            contentType: file.type,
            uploadTaskRef: (uploadTask: DB.UploadTask) => {
              globalStore.subscribeToFileUploadStateChanged(
                uploadTask,
                () => this.onStateChange(uploadTask, toastRef),
                (e) => this.onUploadError(e, toastRef),
              );
            },
          });
          const name = file.name;
          const lastIndex = name.lastIndexOf('.');
          if (lastIndex > -1) {
            const ext = name.slice(lastIndex + 1);
            vertex.createProperty({
              trx,
              role: ['file-extension'],
              contentType: 'text/x-file-extension',
              initialString: ext,
            });
          }
        });
      },
    });
  }

  onStateChange(uploadTask: DB.UploadTask, toastRef: ToastRef) {
    const progress = globalStore.calculateFileUploadProgress(uploadTask);
    console.log('upload progress', progress);
    if (!toastRef.id) {
      toastRef.id = this.toast.create('Upload in progress', {
        type: TYPE.INFO,
        hideProgressBar: true,
        pauseOnFocusLoss: false,
        draggable: false,
        pauseOnHover: false,
        closeOnClick: true,
        closeButton: true,
        position: POSITION.TOP_CENTER,
        handleClick: () => uploadTask.cancel(),
      });
    } else if (progress === 1) {
      void this.toast.update(toastRef.id, {
        progress,
        render: 'Successfully uploaded',
        type: TYPE.SUCCESS,
        closeOnClick: true,
        closeButton: true,
      });
      void this.toast.dismiss(toastRef.id, 3000);
    } else {
      void this.toast.update(toastRef.id, {
        progress,
        hideProgressBar: false,
      });
    }
  }
  onUploadError(e: any, toastRef: ToastRef) {
    if (!toastRef.id) return;
    void this.toast.update(toastRef.id!, {
      render: 'Unable to upload',
      type: TYPE.ERROR,
      closeOnClick: true,
      closeButton: true,
      hideProgressBar: true,
    });
  }
}
