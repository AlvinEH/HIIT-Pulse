import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './index.css';

const updateSW = registerSW({
  onNeedRefresh() { /* optionally prompt user to reload */ },
  onOfflineReady() { /* optional callback */ },
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
