import { QueryString } from '@edvoapp/util';
import { JSX } from 'preact';
import { RoutableProps, route } from 'preact-router';
import { Link } from 'preact-router/match';
import { useEffect, useState } from 'preact/hooks'; // Approved
import { LockIcon, Spinner } from '../../assets';
import { useAsyncFn } from '../../hooks/useAsyncFn';
import './login.scss';
import { AuthService, globalNavigator } from '../..';
import { config } from '@edvoapp/common';
interface Props extends RoutableProps {
  authService: AuthService;
}
export function NativeAppLogin(_props: Props) {
  useEffect(() => {
    console.log('openUriNewTab');
    void globalNavigator().openUriNewTab({
      uri: config.webappUrl + '/launch',
    });
  }, []);

  return (
    <section className="login__content flex-1 flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 h-screen">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Redirecting you to the Edvo Login...
          </h2>
        </div>
        <div>
          <button
            type="submit"
            className="group relative w-full flex justify-center py-2 px-4 mb-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => {
              void globalNavigator().openUriNewTab({
                uri: config.webappUrl + '/launch',
              });
            }}
          >
            Click here to log in to Edvo!
          </button>
          {/* @ts-ignore */}
          <Link href={'/signup?invite=BETA6827'} className="font-medium text-indigo-600 hover:text-indigo-500">
            No account? Try Edvo for free
          </Link>
        </div>
      </div>
    </section>
  );
}
