import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { logger } from './utils/logger.jsx';

// Initialize logging
logger.info('Application starting...');

const root = ReactDOM.createRoot(document.getElementById('root'));

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  logger.info('Application rendered successfully');
} catch (error) {
  logger.error('Failed to render application', error);
} 