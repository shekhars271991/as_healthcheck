import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Configuration from './pages/Configuration.jsx';
import HealthCheckHistory from './pages/HealthCheckHistory.jsx';
import CreateHealthCheck from './pages/CreateHealthCheck.jsx';
import HealthCheckDetails from './pages/HealthCheckDetails.jsx';
import ClusterDetail from './pages/ClusterDetail.jsx';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/health-checks" element={<HealthCheckHistory />} />
            <Route path="/health-check/create" element={<CreateHealthCheck />} />
            <Route path="/health-check/:healthCheckId" element={<HealthCheckDetails />} />
            <Route path="/health-check/:healthCheckId/cluster/:resultKey" element={<ClusterDetail />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/" element={<Navigate to="/health-checks" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 