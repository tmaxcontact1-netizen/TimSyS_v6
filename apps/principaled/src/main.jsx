import React from 'react';
import ReactDOM from 'react-dom/client';
import PrincipalEdDashboard from './dashboard/Index';
import '../../shared-ui/styles/timsys-dark.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrincipalEdDashboard />
  </React.StrictMode>
);
