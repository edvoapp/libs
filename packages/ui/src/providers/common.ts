import { capitalize } from '@edvoapp/util';
import { Context } from 'preact';
import { useContext } from 'preact/hooks';

export function useProvider<ContextType>(context: Context<ContextType>, name: string): NonNullable<ContextType> {
  const label = capitalize(name);
  const ctx = useContext(context);
  if (ctx === null) {
    throw `use${label} must be used within ${label}ContextProvider`;
  }
  return ctx as NonNullable<ContextType>;
}
