import { Firebase } from '@edvoapp/common';
import { QueryString } from '@edvoapp/util';
import { JSX } from 'preact';
import { RoutableProps } from 'preact-router';
import { Link } from 'preact-router/match';
import { useState } from 'preact/hooks'; // Approved
import { LockIcon, Spinner } from '../../assets';
import { useAsyncFn } from '../../hooks';
import './reset-password.scss';

interface ResetPasswordProps extends RoutableProps {}

export function ResetPassword(props: ResetPasswordProps) {
  const [email, setEmail] = useState(''); // Approved
  const [state, handleSubmit] = useAsyncFn(
    async (e: JSX.TargetedEvent) => {
      e.preventDefault();
      const auth = Firebase.firebase.auth();
      await auth.sendPasswordResetEmail(email);
      return 'Success! Check your email.';
    },
    [email],
  );

  return (
    <section className="login__content flex-1 flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset your password</h2>
        </div>
        <form className="mt-8 space-y-6" action="#" method="POST" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
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
                className="form-input appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onInput={(e) => setEmail(e.currentTarget.value)}
              />
            </div>
          </div>
          {state.error && <div>{state.error.message}</div>}
          {state.value && <div>{state.value}</div>}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {/* @ts-ignore */}
              <Link
                href={QueryString.preserveQueryString('/auth/login')}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Back to login
              </Link>
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {state.loading ? (
                  <Spinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                ) : (
                  <LockIcon className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" />
                )}
              </span>
              {state.loading ? 'Processing...' : 'Send password reset email'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
