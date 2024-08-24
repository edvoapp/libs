import { RoutableProps } from 'preact-router';
import { globalStore } from '@edvoapp/common';
import { useAwait, QueryString } from '@edvoapp/util';
import { AuthService } from '../service';

interface TestAutoCreateUserProps extends RoutableProps {
  authService: AuthService;
}
export const TestAutoCreateUser = ({ authService }: TestAutoCreateUserProps) => {
  const done = useAwait(async () => {
    const params = QueryString.parse();
    const email = params.email ?? `test+${Date.now()}@test.com`;
    const password = params.password ?? `${Date.now()}`;
    const fullName = params.name ?? 'test';

    try {
      await authService.createAccount({ fullName, email, password, inviteCode: 'foo', skipRedirect: true });
      return true;
    } catch (err) {
      console.log('TRACE:AutoCreateUser:failed', err);
      return false;
    }
  }, []);

  if (done) {
    return (
      <>
        <div className="test-status">DONE</div>
        <div className="user-id">{globalStore.getCurrentUserID()}</div>
      </>
    );
  }
  return <></>;
};
