import { QueryString } from '@edvoapp/util';
import { JSX } from 'preact';
import { RoutableProps } from 'preact-router';
import { Link } from 'preact-router/match';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'; // Approved
import { EdvoLogoFull, LockIcon, Spinner } from '../../assets';
import { useAsyncFn } from '../../hooks/useAsyncFn';
import { AuthService } from '../../service';
import styled from 'styled-components';
import { config } from '@edvoapp/common';

type InviteeSignupResponse = {
  status: string;
  email: string | undefined;
};

const Banner = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 40px 120px 0 120px;
`;

const InviteSC = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
`;

const InviteSCContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 500px;
`;

const Header = styled.div`
  color: #1a0349;
  font-family: Red Hat Display;
  font-size: 40px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-bottom: 4px;
`;

const Subheader = styled.div`
  color: #666;
  font-family: Red Hat Display;
  font-size: 24px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-bottom: 24px;
`;

const Text = styled.div`
  color: #1a0349;
  font-family: Red Hat Display;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  margin-bottom: 40px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const SubmitButton = styled.button`
  position: relative;
  display: flex;
  align-self: stretch;
  height: 48px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 8px;
  background: #783df6;
  color: white;
  font-family: Red Hat Display;
  font-size: 20px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-top: 40px;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`;

interface InviteProps extends RoutableProps {
  authService: AuthService;
}

const loadingStatements = [
  'Customizing your experience',
  'Tidying up your digital workspace',
  'Reticulating splines',
  'Calibrating your control panel',
  'Synthesizing the elements of your dashboard',
  'Linking your information streams',
  'Harmonizing your data sources',
  'Optimizing your organizational schema',
  'Connecting the dots for you',
  'Aligning the data satellites',
  'Finalizing your custom setup',
];

export function Invite2({ authService }: InviteProps) {
  const [fullName, setFullName] = useState(QueryString.parse().name ?? ''); // Approved
  const [password, setPassword] = useState(''); // Approved
  const [confirmPassword, setConfirmPassword] = useState(''); // Approved

  const disabled = useMemo(
    () => password.length < 6 || confirmPassword.length < 6 || password !== confirmPassword,
    [password, confirmPassword, fullName],
  );

  const [state, handleSubmit] = useAsyncFn(
    async (e: JSX.TargetedEvent) => {
      e.preventDefault();
      const uid = QueryString.parse().uid;
      if (disabled || !uid) return;
      await authService.claimPassword(uid, password, fullName);
    },
    [authService, password, confirmPassword, fullName, disabled],
  );

  const [counter, setCounter] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.loading) {
      const randomInterval = () => Math.floor(Math.random() * (4500 - 1500 + 1)) + 1500;

      timer.current = setInterval(() => {
        setCounter((y) => (y + 1) % loadingStatements.length);
      }, randomInterval());
    }

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [state.loading, counter]);

  return (
    <>
      <Banner>
        <EdvoLogoFull className="pl-logo" data-cy="edvo-logo" />
      </Banner>
      <InviteSC>
        <InviteSCContainer>
          <Header>All your data in one place 🎉</Header>
          <Subheader>Get out of tab hell and organize your thoughts</Subheader>
          <Form
            data-cy="auth-form"
            action="#"
            method="POST"
            // @ts-ignore
            onSubmit={handleSubmit}
          >
            <Text>
              Hello, there! Please fill in the form to create an account and view the shared space! 👀
              <br />
              <br />
              Let's go! 🚀
            </Text>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label for="full-name" className="sr-only">
                  Full Name
                </label>
                <input
                  id="full-name"
                  name="full-name"
                  type="text"
                  autocomplete="full-name"
                  required
                  className="form-input appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Full Name"
                  value={fullName}
                  onInput={(e) => setFullName(e.currentTarget.value)}
                />
              </div>
              <div>
                <label for="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  className="form-input appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                />
              </div>
              <div>
                <label for="password" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autocomplete="current-password"
                  required
                  className="form-input appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                />
              </div>
            </div>
            {state.error ? <div>{state.error.message}</div> : null}
            <SubmitButton type="submit" disabled={disabled}>
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {state.loading ? (
                  <Spinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                ) : (
                  <LockIcon className="h-5 w-5 text-white-500 group-hover:text-white-400" />
                )}
              </span>
              {state.loading ? `${loadingStatements[counter]}...` : 'Create Password and Sign In'}
            </SubmitButton>
          </Form>
        </InviteSCContainer>
      </InviteSC>
    </>
  );
}
