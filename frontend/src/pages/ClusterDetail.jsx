import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Database, ChevronDown, ChevronRight } from 'lucide-react';

const ClusterDetail = () => {
  const { healthCheckId, resultKey } = useParams();
  const navigate = useNavigate();
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNamespaces, setExpandedNamespaces] = useState(new Set());

  useEffect(() => {
    fetchClusterDetails();
  }, [healthCheckId, resultKey]);

  const fetchClusterDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/health-checks/${healthCheckId}/cluster/${resultKey}`);
      const data = await response.json();
      
      if (data.success) {
        setClusterData(data.cluster_data);
      } else {
        setError(data.message || 'Failed to fetch cluster details');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Error fetching cluster details:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNamespace = (namespaceName) => {
    setExpandedNamespaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(namespaceName)) {
        newSet.delete(namespaceName);
      } else {
        newSet.add(namespaceName);
      }
      return newSet;
    });
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading cluster details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
            <button
              onClick={fetchClusterDetails}
              className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!clusterData || !clusterData.data) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Cluster data not found</p>
        </div>
      </div>
    );
  }

  const { data: healthData } = clusterData;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(`/health-check/${healthCheckId}`)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Health Check
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{clusterData.cluster_name}</h1>
            <p className="text-gray-600">
              {clusterData.region_name} • {clusterData.filename} • 
              Processed {formatDate(clusterData.processed_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Cluster Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cluster Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Cluster Name</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.name || 'N/A'}</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Version</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.version || 'N/A'}</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Size</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.size || 'N/A'} nodes</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Namespaces</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.namespaces || 'N/A'} namespaces</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Memory Total</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.memory?.total || 'N/A'}</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Memory Used</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.memory?.used || 'N/A'} ({healthData.clusterInfo?.memory?.usedPercent || 'N/A'})</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">License Usage</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.license?.usage || 'N/A'} ({healthData.clusterInfo?.license?.usagePercent || 'N/A'})</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Last Updated</div>
              <div className="text-sm text-gray-900 font-mono">
                {healthData.lastUpdated ? new Date(healthData.lastUpdated).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Nodes Section */}
        {healthData.nodes?.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Server className="h-5 w-5 mr-2 text-green-600" />
              Nodes ({healthData.nodes.length})
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uptime</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connections</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {healthData.nodes.map((node, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{node.node}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          node.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {node.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{node.uptime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{node.connections}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Namespaces */}
        {healthData.namespaces?.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="h-5 w-5 mr-2 text-purple-600" />
              Namespaces ({healthData.namespaces?.length || 0})
            </h3>
            
            <div className="space-y-2">
              {healthData.namespaces.map((ns, index) => (
                <div key={index} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleNamespace(ns.name)}
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {expandedNamespaces.has(ns.name) ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <h4 className="text-md font-semibold text-gray-900 font-mono">{ns.name}</h4>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          RF: {ns.replicationFactor}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {ns.objects} objects
                        </span>
                      </div>
                    </div>
                  </button>
                  
                  {expandedNamespaces.has(ns.name) && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Replication Factor</div>
                          <div className="text-sm text-gray-900 font-mono">
                            {ns?.replicationFactor || 'N/A'}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Objects</div>
                          <div className="text-sm text-gray-900 font-mono">
                            {ns?.objects || 'N/A'}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Memory Used</div>
                          <div className="text-sm text-gray-900 font-mono">
                            {ns?.memoryUsed || 'N/A'}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Memory Used %</div>
                          <div className="text-sm text-gray-900 font-mono">
                            {ns?.memoryUsedPercent || 'N/A'}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">License Usage</div>
                          <div className="text-sm text-gray-900 font-mono">
                            {ns?.license?.usage || 'N/A'} ({ns?.license?.usagePercent || 'N/A'})
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Unique Data</div>
                          <div className="text-sm text-gray-900 font-mono">
                            {ns?.clientWrites?.uniqueData || 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Client Writes */}
                      {ns?.clientWrites && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <h5 className="text-sm font-medium text-gray-700 mb-3">Client Write Success</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-gray-500">Client Write Success</div>
                              <div className="text-sm text-gray-900 font-mono">
                                {ns.clientWrites.clientWriteSuccess || 'N/A'}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-gray-500">XDR Client Write Success</div>
                              <div className="text-sm text-gray-900 font-mono">
                                {ns.clientWrites.xdrClientWriteSuccess || 'N/A'}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-gray-500">Unique Writes %</div>
                              <div className="text-sm text-gray-900 font-mono">
                                {ns.clientWrites.uniqueWritesPercent || 'N/A'}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-gray-500">Unique Data</div>
                              <div className="text-sm text-gray-900 font-mono">
                                {ns.clientWrites.uniqueData || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClusterDetail; 