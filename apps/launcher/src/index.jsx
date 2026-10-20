import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { ActionFeedbackHost } from '../../shared-ui/react/index.js';
if (window.location.pathname === '/assistant') document.documentElement.classList.add('timsys-assistant-page');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {window.location.pathname !== '/assistant' && <ActionFeedbackHost />}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
