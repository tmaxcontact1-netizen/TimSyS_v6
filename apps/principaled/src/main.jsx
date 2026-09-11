import React from 'react';
import ReactDOM from 'react-dom/client';
import PrincipalEdDashboard from './dashboard/Index';
import '../../shared-ui/styles/timsys-dark.css';
import './styles.css';
import { ActionFeedbackHost } from '../../shared-ui/react/index.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ActionFeedbackHost />
    <PrincipalEdDashboard />
  </React.StrictMode>
);
