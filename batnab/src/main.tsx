import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './lib/install'; // early, so the browser's install offer isn't missed
import {reloadForUpdate} from './lib/update';

// Part of the site failed to download (usually: a new version came out while this page was open).
window.addEventListener('vite:preloadError', () => reloadForUpdate());

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
