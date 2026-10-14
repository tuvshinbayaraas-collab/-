import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/install'; // early, so the browser's install offer isn't missed

createRoot(document.getElementById('root')!).render(<App />);
