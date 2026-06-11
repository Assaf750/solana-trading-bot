import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { I18nProvider } from './i18n/index.jsx';
import { BackendProvider } from './api/useBackend.jsx';
import App from './App.jsx';
import './theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <BackendProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </BackendProvider>
    </I18nProvider>
  </StrictMode>
);
