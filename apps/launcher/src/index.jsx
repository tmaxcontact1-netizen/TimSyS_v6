import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { ActionFeedbackHost } from '../../shared-ui/react/index.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ActionFeedbackHost />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
