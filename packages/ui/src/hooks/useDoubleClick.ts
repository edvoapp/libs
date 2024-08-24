import { useRef } from 'preact/hooks';

export const useDoubleClick = ({
  onClick,
  onDblClick,
  delay = 200,
}: {
  onClick?: (evt: MouseEvent) => void;
  onDblClick?: (evt: MouseEvent) => void;
  delay?: number;
}) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevent = useRef(false);

  const handleClick = (evt: MouseEvent) => {
    timer.current = setTimeout(() => {
      if (!prevent.current) {
        onClick?.(evt);
      }
      prevent.current = false;
    }, delay);
  };
  const handleDoubleClick = (evt: MouseEvent) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    prevent.current = true;
    onDblClick?.(evt);
  };

  return { handleClick, handleDoubleClick };
};
