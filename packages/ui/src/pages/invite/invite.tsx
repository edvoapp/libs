import { QueryString } from '@edvoapp/util';
import { JSX } from 'preact';
import { RoutableProps, route } from 'preact-router';
import { Link } from 'preact-router/match';
import { useMemo, useState, useEffect, useRef } from 'preact/hooks'; // Approved
import { EdvoLogoFull, LockIcon, Spinner } from '../../assets';
import { useAsyncFn } from '../../hooks/useAsyncFn';
import { AuthService } from '../../service';
import styled from 'styled-components';
import { useDebounce } from '../../hooks';

const Banner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 40px 120px 0 120px;
`;

// @ts-ignore
const SignInButton = styled(Link)`
  white-space: nowrap;
  text-decoration: none;
  color: #4d4d4d;
  border: solid 1px #e6e6e6;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  width: 129px;
  height: 48px;
  padding: 13.5px 39px 13.5px 41px;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
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

const InviteCodeContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
`;

const InviteCodeLabel = styled.label`
  color: #000;
  font-family: Red Hat Display;
  font-size: 24px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-right: 18px;
`;

const InviteCodeChecker = styled.div`
  color: var(--color-brand-neutral-600, #666);
  text-align: center;
  font-family: Red Hat Display;
  font-size: 20px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-bottom: 32px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
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
`;

interface InviteProps extends RoutableProps {
  c?: string;
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

export function Invite({ c, authService }: InviteProps) {
  const [fullName, setFullName] = useState(QueryString.parse().name ?? ''); // Approved
  const [email, setEmail] = useState(QueryString.parse().email ?? ''); // Approved
  const [password, setPassword] = useState(''); // Approved
  const [confirmPassword, setConfirmPassword] = useState(''); // Approved
  const [inviteCode, setInviteCode] = useState(() => QueryString.parse().invite ?? '');
  // const [inviteCodeStatus, setInviteCodeStatus] = useState<
  //   null | 'LOADING' | 'BETA' | 'INVALID'
  // >(null);
  //
  // const betaCodes = ['beta6827', 'beta9268'];
  //
  // const disabled = useMemo(
  //   () => inviteCodeStatus !== 'BETA',
  //   [inviteCodeStatus],
  // );
  const disabled = false;
  const valid = useMemo(
    () => [fullName, email, password, confirmPassword].every((x) => !!x),
    [fullName, email, password, confirmPassword],
  );
  //
  // useEffect(() => {
  //   setInviteCodeStatus(inviteCode ? 'LOADING' : null);
  // }, [inviteCode]);
  //
  // const [ready, cancel] = useDebounce(
  //   () => {
  //     if (inviteCode) {
  //       setInviteCodeStatus(
  //         betaCodes.includes(inviteCode.toLowerCase()) ? 'BETA' : 'INVALID',
  //       );
  //     }
  //   },
  //   1_000,
  //   [inviteCode],
  // );

  const [state, handleSubmit] = useAsyncFn(
    async (e: JSX.TargetedEvent) => {
      e.preventDefault();
      if (disabled || !valid) return;

      const userID = await authService.createAccount({
        fullName,
        email,
        password,
        inviteCode,
      });

      // TODO: re-enable later
      // location.href = `https://buy.stripe.com/00g7uv4jL59R8g04gl?client_reference_id=${userID}`;
    },
    [authService, email, password, confirmPassword, fullName, inviteCode, disabled, valid],
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
        <SignInButton href={QueryString.preserveQueryString('/auth/login')}>Sign In</SignInButton>
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
            {/*<InviteCodeContainer>*/}
            {/*  <InviteCodeLabel htmlFor="invite-code">*/}
            {/*    Invite code:*/}
            {/*  </InviteCodeLabel>*/}
            {/*  <input*/}
            {/*    id="invite-code"*/}
            {/*    name="invite-code"*/}
            {/*    type="text"*/}
            {/*    required*/}
            {/*    className="form-input appearance-none rounded-none relative block px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"*/}
            {/*    placeholder="Code"*/}
            {/*    value={inviteCode.toUpperCase()}*/}
            {/*    onInput={(e) =>*/}
            {/*      setInviteCode(e.currentTarget.value.toUpperCase())*/}
            {/*    }*/}
            {/*  />*/}
            {/*</InviteCodeContainer>*/}
            {/*<InviteCodeChecker>*/}
            {/*  /!*{inviteCodeStatus === 'BETA' && '✅ Early access with 1GB of storage'}*!/*/}
            {/*  {inviteCodeStatus === 'BETA' &&*/}
            {/*    '✅ Free trial for 4 weeks. No credit card required.'}*/}
            {/*  {inviteCodeStatus === 'LOADING' && (*/}
            {/*    <Spinner className="animate-spin h-5 w-5" />*/}
            {/*  )}*/}
            {/*  {inviteCodeStatus === 'INVALID' && '❌ Invalid invite code'}*/}
            {/*</InviteCodeChecker>*/}
            {/*<Text>*/}
            {/*  We’re building Edvo for you and we recommend signing up with a*/}
            {/*  personal email.*/}
            {/*</Text>*/}
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
                  disabled={disabled}
                  onInput={(e) => setFullName(e.currentTarget.value)}
                />
              </div>
              <div>
                <label for="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  className="form-input appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  disabled={disabled}
                  onInput={(e) => setEmail(e.currentTarget.value)}
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
                  disabled={disabled}
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
                  disabled={disabled}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                />
              </div>
            </div>
            {state.error ? <div>{state.error.message}</div> : null}
            <SubmitButton type="submit" disabled={!valid}>
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {state.loading ? (
                  <Spinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                ) : (
                  <LockIcon className="h-5 w-5 text-white-500 group-hover:text-white-400" />
                )}
              </span>
              {state.loading ? `${loadingStatements[counter]}...` : 'Create account'}
            </SubmitButton>
          </Form>
        </InviteSCContainer>
      </InviteSC>
    </>
  );
}
