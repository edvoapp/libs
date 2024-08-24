import {
  AnyComponent,
  createElement,
  FunctionalComponent,
  RenderableProps,
  ComponentChild,
  ComponentChildren,
} from 'preact';

export {
  Attributes,
  FunctionalComponent as SFC,
  AnyComponent as ComponentType,
  AnyComponent as JSXElementConstructor,
  Component as ComponentClass,
  ClassAttributes,
  PreactContext as Context,
  PreactProvider as Provider,
  VNode as ReactElement,
  createElement,
  Fragment,
  Ref,
  render,
  JSX,
  RenderableProps as ComponentPropsWithRef,
} from 'preact';

export type ReactNode = ComponentChild | ComponentChildren;
