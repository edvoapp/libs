import { toast, ToastOptions, UpdateOptions, ToastContainerProps, ToastContent } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { wait } from '@edvoapp/util';
export const { POSITION, TYPE } = toast;

interface ToastOps extends ToastOptions {
  handleClick?: Function;
}

export function createToast(content: ToastContent, params: ToastOps): number | string {
  const id = toast(content, params) as string;
  if (params.handleClick) {
    void wait(100).then(() => {
      const node = document.getElementById(id);
      //@ts-ignore
      node?.addEventListener('click', params.handleClick, true);
    });
  }
  return id;
}

export async function updateToast(id: number | string, options?: UpdateOptions) {
  if (options?.progress) {
    await wait(+options.progress * 1000);
    if (options.progress === 1) options.progress = 0.9999;
  }
  return toast.update(id, options);
}

export async function dismissToast(id: number | string, delay = 0) {
  await wait(delay);
  toast.dismiss(id);
}

export class ToastService {
  constructor(params?: ToastContainerProps) {
    toast.configure(params);
  }
  create(content: ToastContent, params: ToastOps): number | string {
    return createToast(content, params);
  }
  async update(id: number | string, options?: UpdateOptions) {
    return updateToast(id, options);
  }
  async dismiss(id: number | string, delay = 0) {
    return dismissToast(id, delay);
  }
}
