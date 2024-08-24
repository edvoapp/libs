import { FunctionComponent, h } from 'preact';
import { useHighlights } from '../hooks/highlight-manager';
import { useLocation } from '../hooks/location-manager';
import { usePubSub } from '../hooks/pubsub';
import { ModeProvider } from '../providers';
import { SiteStyleModelProvider } from '../providers/site-style-model-provider';
import { PhantomDom } from './phantom-dom/phantom-dom';

// mix in the hooks

const Providers: FunctionComponent = ({ children }) => {
  usePubSub();
  return (
    <ModeProvider>
      <SiteStyleModelProvider>{children}</SiteStyleModelProvider>
    </ModeProvider>
  );
};

function RootApp() {
  useLocation();
  useHighlights();
  return <PhantomDom />;
}

const App: FunctionComponent = () => {
  return (
    <Providers>
      <RootApp />
    </Providers>
  );
};

export default App;
