import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClusterHealth from './pages/ClusterHealth.jsx';
import Performance from './pages/Performance.jsx';
import Configuration from './pages/Configuration.jsx';
import SystemInfo from './pages/SystemInfo.jsx';
import XDRStatus from './pages/XDRStatus.jsx';
import Logs from './pages/Logs.jsx';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cluster-health" element={<ClusterHealth />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/system-info" element={<SystemInfo />} />
            <Route path="/xdr-status" element={<XDRStatus />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 