// import { FunctionComponent } from 'preact';
// import { forwardRef } from 'preact/compat';
// import { TextareaAutosize, TextareaAutosizeProps } from '../textarea-autosize';
// import cx from 'classnames';

// export interface TextareaComponentProps extends TextareaAutosizeProps {
//   autofocus?: boolean;
// }

// export const TextareaComponent = forwardRef<
//   HTMLTextAreaElement,
//   TextareaComponentProps
// >(
//   (
//     { value, onChange, readonly, placeholder, onFocus, onBlur, ...props },
//     ref,
//   ) => {
//     // const [rows, setRows] = useState(1) // Approved
//     // TODO: implement row-numbers https://jsfiddle.net/9QzQy/

//     // const calculateRowNumber = useCallback(() => {
//     //   if (iteration === 0) {
//     //     initialHeight =
//     //   }
//     // }, [])

//     // in HTML, textarea does not support the value parameter. In React, child value is not supported (e.g., <textarea>{value}</textarea> is not supported)
//     // ref: https://reactjs.org/docs/forms.html#the-textarea-tag
//     return (
//       <div className={cx('textarea-component-wrapper', { readonly })}>
//         {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
//         {/* @ts-ignore */}
//         <TextareaAutosize
//           className={cx('textarea-component focus-target', { readonly })}
//           onInput={onChange}
//           onFocus={onFocus}
//           onBlur={onBlur}
//           readOnly={readonly}
//           placeholder={placeholder}
//           value={value}
//           //@ts-expect-error foo
//           ref={ref}
//           {...props}
//           // style={{
//           //   overflow: 'hidden',
//           //   minHeight: `${rows}em`,
//           // }}
//         />
//         {/* <div
//           style={{
//             display: 'none',
//             wordWrap: 'break-word',
//             whiteSpace: 'normal',
//             padding: getCss(ref.current, 'padding') as number,
//             width: getCss(ref.current, 'width') as number,
//             fontFamily: getCss(ref.current, 'fontFamily') as number,
//             fontSize: getCss(ref.current, 'fontSize') as number,
//             lineHeight: getCss(ref.current, 'lineHeight') as number,
//           }}
//         >
//           {value}
//         </div> */}
//       </div>
//     );
//   },
// );
