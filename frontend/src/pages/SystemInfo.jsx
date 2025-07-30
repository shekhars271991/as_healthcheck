import React, { useState, useEffect } from 'react';
import { Network, Server, Activity, Database } from 'lucide-react';

const SystemInfo = () => {
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

  const EmptyState = () => (
    <div className="text-center py-12">
      <Network className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No network data available</h3>
      <p className="mt-1 text-sm text-gray-500">
        Upload a collectinfo file from the dashboard to view network information.
      </p>
    </div>
  );

  const NetworkOverview = () => (
    <div className="card mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Network className="h-5 w-5 mr-2 text-blue-600" />
        Network Information
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {healthData.networkInfo?.nodes?.length || 0}
          </div>
          <div className="text-sm text-gray-600">Total Nodes</div>
        </div>
        
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {healthData.clusterInfo?.size || 0}
          </div>
          <div className="text-sm text-gray-600">Cluster Size</div>
        </div>
        
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {healthData.clusterInfo?.namespaces || 0}
          </div>
          <div className="text-sm text-gray-600">Namespaces</div>
        </div>
      </div>
    </div>
  );

  const NetworkNodes = () => (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Server className="h-5 w-5 mr-2 text-green-600" />
        Network Nodes ({healthData.networkInfo?.nodes?.length || 0})
      </h3>
      
      {healthData.networkInfo?.nodes?.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Build</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Migrations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connections</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uptime</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {healthData.networkInfo.nodes.map((node, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {node.node}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {node.nodeId || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {node.ip || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {node.build || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {node.migrations || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {node.clientConnections || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {node.uptime || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8">
          <Server className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">No network nodes found</p>
        </div>
      )}
    </div>
  );

  const ClusterInfo = () => (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Activity className="h-5 w-5 mr-2 text-purple-600" />
        Cluster Information
      </h3>
      
      {healthData.networkInfo?.nodes?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500">Cluster Size</div>
            <div className="text-sm text-gray-900 font-mono">
              {healthData.networkInfo.nodes[0]?.cluster?.size || 'N/A'}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500">Cluster Key</div>
            <div className="text-sm text-gray-900 font-mono">
              {healthData.networkInfo.nodes[0]?.cluster?.key || 'N/A'}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500">Integrity</div>
            <div className="text-sm text-gray-900 font-mono">
              {healthData.networkInfo.nodes[0]?.cluster?.integrity || 'N/A'}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500">Principal Node</div>
            <div className="text-sm text-gray-900 font-mono">
              {healthData.networkInfo.nodes[0]?.cluster?.principal || 'N/A'}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Activity className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">No cluster information available</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">System Information</h1>
        <p className="text-gray-600">Network configuration and system details</p>
      </div>

      {healthData ? (
        <div className="space-y-6">
          <NetworkOverview />
          <NetworkNodes />
          <ClusterInfo />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
};

export default SystemInfo; 