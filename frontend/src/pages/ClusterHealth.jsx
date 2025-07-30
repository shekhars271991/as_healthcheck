import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, Database, Activity, Shield } from 'lucide-react';

const ClusterHealth = () => {
  const [expandedSections, setExpandedSections] = useState(new Set(['health', 'summary']));
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    // Load health data from localStorage
    const savedData = localStorage.getItem('aerospike_health_data');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setHealthData(parsedData);
      } catch (error) {
        console.error('Failed to parse health data from localStorage:', error);
      }
    }
  }, []);

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getHealthStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <Database className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No health data available</h3>
      <p className="mt-1 text-sm text-gray-500">
        Upload a collectinfo file from the dashboard to view cluster health details.
      </p>
    </div>
  );

  const HealthOverview = () => (
    <div className="card mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Activity className="h-5 w-5 mr-2 text-blue-600" />
        Overall Health Status
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {healthData.health?.overall || 'Unknown'}
          </div>
          <div className="text-sm text-gray-600">Overall Status</div>
          <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthStatusColor(healthData.health?.overall)}`}>
            {healthData.health?.overall || 'Unknown'}
          </div>
        </div>
        
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {healthData.health?.passed || 0}
          </div>
          <div className="text-sm text-gray-600">Passed Checks</div>
          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Passed
          </div>
        </div>
        
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">
            {healthData.health?.failed || 0}
          </div>
          <div className="text-sm text-gray-600">Failed Checks</div>
          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </div>
        </div>
        
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {healthData.health?.skipped || 0}
          </div>
          <div className="text-sm text-gray-600">Skipped Checks</div>
          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Skipped
          </div>
        </div>
      </div>
    </div>
  );

  const HealthIssues = () => (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Shield className="h-5 w-5 mr-2 text-red-600" />
        Health Issues ({healthData.health?.issues?.length || 0})
      </h3>
      
      {healthData.health?.issues?.length > 0 ? (
        <div className="space-y-3">
          {healthData.health.issues.map((issue, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                {issue}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
          <p className="mt-2 text-sm text-gray-600">No health issues found</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cluster Health</h1>
        <p className="text-gray-600">Detailed health check results and cluster status</p>
      </div>

      {healthData ? (
        <div className="space-y-6">
          <HealthOverview />
          <HealthIssues />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
};

export default ClusterHealth; 