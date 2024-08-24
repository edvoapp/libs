import { toast } from 'react-toastify';

export function raiseError(message: string) {
  toast(message, {
    type: toast.TYPE.ERROR,
    autoClose: false,
    hideProgressBar: true,
    closeOnClick: true,
    draggable: false,
    position: toast.POSITION.BOTTOM_LEFT,
  });
}

if (window.edvocommon?.Util !== undefined) {
  window.edvocommon.Util.bindRaiseError(raiseError);
}
