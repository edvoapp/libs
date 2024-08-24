import autosize from 'autosize';
import { JSX, Ref } from 'preact';
import { forwardRef } from 'preact/compat';
import { useCallback, useEffect, useRef } from 'preact/hooks';
import styled from 'styled-components';

const Textarea = styled.textarea`
  color: inherit;
`;

export type TextareaAutosizeProps = JSX.HTMLAttributes<HTMLTextAreaElement>;

export const TextareaAutosize = forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
  ({ as, ...props }, userRef: Ref<HTMLTextAreaElement>) => {
    const internalRef = useRef<HTMLTextAreaElement>();

    const handleEdvoClick = useCallback((evt: CustomEvent<{ clientX: number; clientY: number }>) => {}, []);

    useEffect(() => {
      const el = internalRef.current;
      if (el) {
        autosize(el);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        el.addEventListener('edvo-click', handleEdvoClick);
      }
      return () => {
        if (el) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          el.removeEventListener('edvo-click', handleEdvoClick);
          autosize.destroy(el);
        }
      };
    }, [handleEdvoClick]);
    return (
      // @ts-ignore
      <Textarea
        ref={(r: any) => {
          if (typeof userRef === 'function') {
            userRef(r);
          } else if (userRef) {
            userRef.current = r;
          }
          internalRef.current = r || undefined;
        }}
        rows={1}
        as={as as any}
        {...props}
      />
    );
  },
);

export default TextareaAutosize;
