import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Database, Activity, Eye, ChevronRight, Calendar, Server, Loader2, CheckCircle, XCircle, RefreshCw, Clock, Upload, Plus } from 'lucide-react';

const HealthCheckDetails = () => {
  const { healthCheckId } = useParams();
  const navigate = useNavigate();
  const [healthCheckData, setHealthCheckData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState({}); // Track uploading state per region

  useEffect(() => {
    fetchHealthCheckDetails();
  }, [healthCheckId]);

  const fetchHealthCheckDetails = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`http://localhost:8000/health-checks/${healthCheckId}`);
      const data = await response.json();
      
      if (data.success) {
        setHealthCheckData(data);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch health check details');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Error fetching health check details:', err);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    fetchHealthCheckDetails(true);
  };

  const handleUploadMoreFiles = async (regionName, files) => {
    if (!files || files.length === 0) return;

    setUploading(prev => ({ ...prev, [regionName]: true }));

    try {
      const formData = new FormData();
      
      // Add all selected files
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      
      // Add region name
      formData.append('region_name', regionName);

      const uploadResponse = await fetch(`http://localhost:8000/health-checks/${healthCheckId}/upload`, {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(`Failed to upload files for region ${regionName}: ${uploadData.message}`);
      }

      // Refresh the page to show new clusters
      await fetchHealthCheckDetails(true);
      
    } catch (err) {
      setError(err.message || 'Failed to upload files');
      console.error('Error uploading files:', err);
    } finally {
      setUploading(prev => ({ ...prev, [regionName]: false }));
    }
  };

  const triggerFileInput = (regionName) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.tgz,.tar.gz,.zip,*'; // Accept various file types
    input.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadMoreFiles(regionName, e.target.files);
      }
    };
    input.click();
  };

  const handleViewCluster = (resultKey) => {
    navigate(`/health-check/${healthCheckId}/cluster/${resultKey}`);
  };

  const getClusterStatusInfo = (cluster) => {
    const status = cluster.status || 'unknown';
    
    switch (status) {
      case 'waiting':
        return {
          icon: <Clock className="h-4 w-4" />,
          label: 'Waiting for upload',
          color: 'bg-yellow-100 text-yellow-800',
          canView: false
        };
      case 'processing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: 'Processing',
          color: 'bg-blue-100 text-blue-800',
          canView: false
        };
      case 'completed':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Completed',
          color: 'bg-green-100 text-green-800',
          canView: true
        };
      case 'failed':
        return {
          icon: <XCircle className="h-4 w-4" />,
          label: 'Failed',
          color: 'bg-red-100 text-red-800',
          canView: false
        };
      default:
        return {
          icon: <Activity className="h-4 w-4" />,
          label: 'Unknown',
          color: 'bg-gray-100 text-gray-800',
          canView: false
        };
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const calculateRegionSummary = (region) => {
    const clusters = region.clusters || [];
    let totalMemory = 0;
    let totalLicense = 0;
    let healthIssues = 0;

    clusters.forEach(cluster => {
      const data = cluster.data;
      if (data && data.clusterInfo && data.clusterInfo.memory) {
        // Extract numeric value from memory used
        const memoryUsed = data.clusterInfo.memory.used;
        if (memoryUsed) {
          const numericValue = parseFloat(memoryUsed.replace(/[^0-9.]/g, ''));
          if (!isNaN(numericValue)) {
            totalMemory += numericValue;
          }
        }
      }
      
      if (data && data.clusterInfo && data.clusterInfo.license) {
        const licenseUsed = data.clusterInfo.license.usage;
        if (licenseUsed) {
          const numericValue = parseFloat(licenseUsed.replace(/[^0-9.]/g, ''));
          if (!isNaN(numericValue)) {
            totalLicense += numericValue;
          }
        }
      }

      if (data && data.health && data.health.failed) {
        healthIssues += parseInt(data.health.failed) || 0;
      }
    });

    return {
      totalClusters: clusters.length,
      totalMemory: totalMemory.toFixed(1),
      totalLicense: totalLicense.toFixed(1),
      healthIssues
    };
  };

  const getOverallHealthStatus = (regions) => {
    let totalIssues = 0;
    let totalClusters = 0;

    regions.forEach(region => {
      const summary = calculateRegionSummary(region);
      totalIssues += summary.healthIssues;
      totalClusters += summary.totalClusters;
    });

    if (totalIssues === 0) return { status: 'Healthy', color: 'text-green-600' };
    if (totalIssues < totalClusters * 2) return { status: 'Warning', color: 'text-yellow-600' };
    return { status: 'Critical', color: 'text-red-600' };
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading health check details...</p>
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
              onClick={fetchHealthCheckDetails}
              className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!healthCheckData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Health check not found</p>
        </div>
      </div>
    );
  }

  const { health_check, regions, summary } = healthCheckData;
  const overallHealth = getOverallHealthStatus(regions);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/health-checks')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Health Checks
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{health_check.customer_name}</h1>
            <p className="text-gray-600">Multi-region health check analysis</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {/* <div className="text-right">
              <div className={`text-lg font-semibold ${overallHealth.color}`}>
                {overallHealth.status}
              </div>
              <div className="text-sm text-gray-500">Overall Status</div>
            </div> */}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{summary.total_regions}</div>
          <div className="text-sm text-gray-600">Regions</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{summary.total_clusters}</div>
          <div className="text-sm text-gray-600">Clusters</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">
            {regions.reduce((total, region) => {
              const summary = calculateRegionSummary(region);
              return total + parseFloat(summary.totalMemory);
            }, 0).toFixed(1)} GB
          </div>
          <div className="text-sm text-gray-600">Total Memory</div>
        </div>
        <div className="card text-center">
          <div className="text-sm text-gray-600 mb-1">Created</div>
          <div className="text-sm font-medium text-gray-900">
            {formatDate(health_check.created_at)}
          </div>
        </div>
      </div>

      {/* Regions */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Regions</h2>
        
        {regions.map((region, index) => {
          const regionSummary = calculateRegionSummary(region);
          
          return (
            <div key={index} className="card">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{region.region_name}</h3>
                  <p className="text-sm text-gray-600">
                    {regionSummary.totalClusters} clusters • 
                    {regionSummary.totalMemory} GB memory • 
                    {regionSummary.totalLicense} GB license • 
                    {regionSummary.healthIssues} issues
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => triggerFileInput(region.region_name)}
                    disabled={uploading[region.region_name]}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading[region.region_name] ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Upload More Files
                      </>
                    )}
                  </button>
                  {/* <div className="text-right">
                    <div className={`text-sm font-medium ${
                      regionSummary.healthIssues === 0 ? 'text-green-600' : 
                      regionSummary.healthIssues < regionSummary.totalClusters ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {regionSummary.healthIssues === 0 ? 'Healthy' : 
                       regionSummary.healthIssues < regionSummary.totalClusters ? 'Warning' : 'Critical'}
                    </div>
                  </div> */}
                </div>
              </div>

              {/* Clusters in this region */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Clusters</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {region.clusters.map((cluster, clusterIndex) => {
                    const clusterData = cluster.data;
                    const statusInfo = getClusterStatusInfo(cluster);
                    
                    // Extract cluster information for display
                    const realClusterName = clusterData?.clusterInfo?.name || cluster.cluster_name;
                    const totalMemory = clusterData?.clusterInfo?.memory?.total || 'N/A';
                    const memoryUsed = clusterData?.clusterInfo?.memory?.used || 'N/A';
                    const namespaceCount = clusterData?.namespaces?.length || 0;
                    
                    // Calculate unique memory used (sum of all namespace unique data)
                    const uniqueMemoryUsed = clusterData?.namespaces?.reduce((total, ns) => {
                      const uniqueData = parseFloat(ns.clientWrites?.uniqueData?.replace(/[^\d.]/g, '') || 0);
                      return total + uniqueData;
                    }, 0).toFixed(2) + ' GB' || 'N/A';
                    
                    return (
                      <div key={clusterIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-medium text-gray-900">{realClusterName}</h5>
                            <p className="text-xs text-gray-500">{cluster.filename}</p>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span className="ml-1">{statusInfo.label}</span>
                            </span>
                          </div>
                        </div>
                        
                        {statusInfo.canView ? (
                          <div className="space-y-1 text-xs text-gray-600 mb-3">
                            <div className="flex justify-between">
                              <span>Total Memory:</span>
                              <span>{totalMemory}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Memory Used:</span>
                              <span>{memoryUsed}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Namespaces:</span>
                              <span>{namespaceCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Unique Memory:</span>
                              <span>{uniqueMemoryUsed}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 text-center py-6 mb-3">
                            {cluster.status === 'waiting' ? 'Waiting for file upload...' :
                             cluster.status === 'processing' ? 'Analyzing collectinfo...' :
                             cluster.status === 'failed' ? `Failed: ${cluster.error || 'Unknown error'}` :
                             'Waiting for processing'}
                          </div>
                        )}
                        
                        <button
                          onClick={() => handleViewCluster(cluster.result_key)}
                          disabled={!statusInfo.canView}
                          className={`w-full inline-flex items-center justify-center px-3 py-2 border shadow-sm text-xs font-medium rounded-md transition-colors ${
                            statusInfo.canView 
                              ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50' 
                              : 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                          }`}
                        >
                          {statusInfo.canView ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </>
                          ) : (
                            <>
                              {statusInfo.icon}
                              <span className="ml-1">{statusInfo.label}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HealthCheckDetails; 