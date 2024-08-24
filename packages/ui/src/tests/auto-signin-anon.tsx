import { RoutableProps, route } from 'preact-router';
import { useEffect } from 'preact/hooks';
import { Model, trxWrap } from '@edvoapp/common';
import { useAwait } from '@edvoapp/util';
import { AuthService } from '..';

interface TestAutoSigninAnonProps extends RoutableProps {
  authService: AuthService;
}

export const TestAutoSigninAnon = ({ authService }: TestAutoSigninAnonProps) => {
  const done = useAwait(async () => {
    try {
      await authService.signInAnonymously();
      route('/test/auto/topic');
      console.log('TRACE:navigated');
      return true;
    } catch (err) {
      console.log('TRACE:AutoSigninAnon:failed', err);
      return false;
    }
  }, []);

  return null;
};
