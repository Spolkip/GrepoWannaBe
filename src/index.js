import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <div className="bg-gray-900 text-white min-h-screen font-sans">
        <App />
      </div>
    </AuthProvider>
  </React.StrictMode>
);