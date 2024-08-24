import { Context } from 'preact';
import { useContext } from 'preact/hooks';

function capitalize(str: string) {
  if (str === '') return '';
  return `${str[0].toUpperCase()}${str.substring(1)}`;
}

export function useProvider<ContextType>(context: Context<ContextType>, name: string): NonNullable<ContextType> {
  const label = capitalize(name);
  const ctx = useContext(context);
  if (ctx === null) {
    throw `use${label} must be used within ${label}ContextProvider`;
  }
  return ctx as NonNullable<ContextType>;
}
