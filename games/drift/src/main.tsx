import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initSpeedFromUrl } from './lib/clock';
import './styles/app.css';

initSpeedFromUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
