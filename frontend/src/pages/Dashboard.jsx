import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Database, 
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Server,
  AlertTriangle
} from 'lucide-react';
import { logger } from '../utils/logger.jsx';

const Dashboard = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedFile = localStorage.getItem('aerospike_health_file');
    const savedHealthData = localStorage.getItem('aerospike_health_data');
    const savedTimestamp = localStorage.getItem('aerospike_health_timestamp');
    
    if (savedFile && savedHealthData && savedTimestamp) {
      try {
        const parsedFile = JSON.parse(savedFile);
        const parsedHealthData = JSON.parse(savedHealthData);
        
        // Check if data is not too old (7 days)
        const dataAge = Date.now() - new Date(savedTimestamp).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        if (dataAge > maxAge) {
          logger.info('Data in localStorage is too old, clearing...');
          clearFromLocalStorage();
          return;
        }
        
        // Recreate file object from saved data
        const fileObj = new File([parsedFile.content], parsedFile.name, {
          type: parsedFile.type,
          lastModified: parsedFile.lastModified
        });
        
        setFile(fileObj);
        setHealthData(parsedHealthData);
        logger.info('Restored data from localStorage', { 
          filename: parsedFile.name,
          dataSize: Object.keys(parsedHealthData).length,
          age: Math.round(dataAge / (1000 * 60 * 60)) + ' hours'
        });
      } catch (err) {
        logger.error('Failed to restore data from localStorage', err);
        // Clear corrupted data
        clearFromLocalStorage();
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  const saveToLocalStorage = (fileObj, healthDataObj) => {
    try {
      if (fileObj && healthDataObj) {
        // Convert file to storable format
        const fileReader = new FileReader();
        fileReader.onload = () => {
          const fileData = {
            name: fileObj.name,
            type: fileObj.type,
            lastModified: fileObj.lastModified,
            content: fileReader.result
          };
          
          localStorage.setItem('aerospike_health_file', JSON.stringify(fileData));
          localStorage.setItem('aerospike_health_data', JSON.stringify(healthDataObj));
          localStorage.setItem('aerospike_health_timestamp', new Date().toISOString());
          logger.info('Data saved to localStorage', { filename: fileObj.name });
        };
        fileReader.readAsText(fileObj);
      }
    } catch (err) {
      logger.error('Failed to save data to localStorage', err);
    }
  };

  // Clear data from localStorage
  const clearFromLocalStorage = () => {
    localStorage.removeItem('aerospike_health_file');
    localStorage.removeItem('aerospike_health_data');
    localStorage.removeItem('aerospike_health_timestamp');
    logger.info('Data cleared from localStorage');
  };

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    console.log('File upload event:', event.target.files); // Debug log
    
    if (uploadedFile) {
      console.log('File selected:', uploadedFile.name, uploadedFile.type, uploadedFile.size); // Debug log
      
      // Accept collectinfo files (tar, zip, etc.) or files without extensions
      const fileName = uploadedFile.name.toLowerCase();
      const hasExtension = fileName.includes('.');
      const isValidFile = fileName.includes('collectinfo') || 
                         fileName.includes('aerospike') || 
                         fileName.endsWith('.tar') || 
                         fileName.endsWith('.tar.gz') || 
                         fileName.endsWith('.tgz') ||
                         fileName.endsWith('.zip') ||
                         fileName.endsWith('.gz') ||
                         !hasExtension || // Allow files without extensions
                         fileName.length < 20; // Allow short filenames (likely collectinfo files)
      
      if (isValidFile) {
        setFile(uploadedFile);
        setError(null);
        await processHealthReport(uploadedFile);
      } else {
        setError('Please select a valid collectinfo file (tar, zip, or files without extensions)');
      }
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      const fileName = droppedFile.name.toLowerCase();
      const hasExtension = fileName.includes('.');
      const isValidFile = fileName.includes('collectinfo') || 
                         fileName.includes('aerospike') || 
                         fileName.endsWith('.tar') || 
                         fileName.endsWith('.tar.gz') || 
                         fileName.endsWith('.tgz') ||
                         fileName.endsWith('.zip') ||
                         fileName.endsWith('.gz') ||
                         !hasExtension || // Allow files without extensions
                         fileName.length < 20; // Allow short filenames (likely collectinfo files)
      
      if (isValidFile) {
        setFile(droppedFile);
        setError(null);
        await processHealthReport(droppedFile);
      } else {
        setError('Please drop a valid collectinfo file (tar, zip, or files without extensions)');
      }
    }
  };

  const processHealthReport = async (file) => {
    setIsProcessing(true);
    setError(null);
    logger.info('=== Starting file upload process ===', {
      filename: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    try {
      // Create FormData to send to backend
      const formData = new FormData();
      formData.append('file', file);

      // Send to backend API
      logger.info('Sending file to backend API', { url: 'http://localhost:8000/upload' });
      
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      logger.info('Backend response received', { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Backend API error', { 
          status: response.status, 
          statusText: response.statusText,
          errorText: errorText 
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      logger.info('Backend response parsed successfully', { 
        success: result.success,
        filename: result.filename,
        dataSize: result.data ? Object.keys(result.data).length : 0
      });
      
      if (result.success) {
        // Transform backend data to frontend format using Gemini parsed data
        const transformedData = {
          overallHealth: result.data.health?.summary?.passed > result.data.health?.summary?.failed ? 'healthy' : 'unhealthy',
          nodeCount: result.data.nodes?.length || result.data.cluster_info?.cluster_size || 0,
          activeConnections: result.data.nodes?.reduce((sum, node) => sum + (node.client_connections || 0), 0) || 0,
          cacheHitRate: 0, // Not available in current data
          latency: result.data.performance?.latency?.[0]?.ops_per_sec || 0,
          issues: result.data.health?.summary?.failed || 0,
          warnings: result.data.health?.summary?.skipped || 0,
          lastUpdated: result.data.parsed_at || new Date().toISOString(),
          rawText: result.data.raw_content || '',
          sections: {
            summary: result.data.summary || [],
            health: result.data.health || [],
            performance: result.data.performance || [],
            configuration: result.data.configuration || [],
            systemInfo: result.data.system_info || [],
            xdrStatus: result.data.xdr_status || [],
            logs: result.data.logs || []
          },
          clusterInfo: {
            name: result.data.cluster_info?.cluster_name || 'Aerospike Cluster',
            serverVersion: result.data.cluster_info?.server_version || '',
            osVersion: result.data.cluster_info?.os_version || '',
            clusterSize: result.data.cluster_info?.cluster_size || result.data.nodes?.length || 0,
            devices: { 
              total: result.data.cluster_info?.devices_total || 0, 
              perNode: result.data.cluster_info?.devices_per_node || 0 
            },
            shmemIndex: { 
              used: result.data.cluster_info?.shmem_index_used || '0 GB', 
              unit: 'GB' 
            },
            memory: { 
              total: result.data.cluster_info?.memory_total || '0 GB',
              used: result.data.cluster_info?.memory_used || '0 GB', 
              usedPercent: result.data.cluster_info?.memory_used_percent || '0 %',
              available: result.data.cluster_info?.memory_avail || '0 GB', 
              unit: 'GB' 
            },
            licenseUsage: { 
              latest: result.data.cluster_info?.license_usage_latest || '0 GB', 
              unit: 'GB' 
            },
            activeNamespaces: { 
              count: result.data.cluster_info?.namespaces_active || 0, 
              total: result.data.cluster_info?.namespaces_total || 0 
            },
            activeFeatures: result.data.cluster_info?.active_features?.split(',') || []
          },
          // Use namespaces from Gemini parsing
          namespaces: result.data.namespaces?.map(ns => ({
            name: ns.namespace || 'Unknown Namespace',
            devices: { total: ns.drives_total || 0, perNode: ns.drives_per_node || 0 },
            shmemIndex: { used: '0 GB', unit: 'GB' },
            memory: { 
              total: ns.memory_total || '0 GB',
              used: '0 GB', 
              usedPercent: ns.memory_used_percent || '0 %',
              available: '0 GB', 
              unit: 'GB' 
            },
            licenseUsage: { latest: '0 GB', unit: 'GB' },
            replicationFactor: ns.replication_factor || 0,
            rackAware: false,
            masterObjects: { 
              count: ns.master_objects?.replace(' M', '') || 0, 
              unit: 'M' 
            },
            compressionRatio: ns.compression_ratio || 0,
            // Add any additional namespace info
            additionalInfo: ns
          })) || []
        };
        
        setHealthData(transformedData);
        
        // Save to localStorage
        saveToLocalStorage(file, transformedData);
        
        logger.info('=== File upload process completed successfully ===', { 
          filename: file.name,
          dataSize: Object.keys(transformedData).length,
          sections: Object.keys(transformedData.sections || {}),
          clusterInfo: transformedData.clusterInfo ? Object.keys(transformedData.clusterInfo) : []
        });
      } else {
        throw new Error(result.message || 'Failed to process file');
      }
    } catch (err) {
      logger.error('=== File upload process failed ===', {
        error: err.message,
        stack: err.stack,
        filename: file.name,
        fileSize: file.size
      });
      setError(`Failed to process health report: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const replaceFile = () => {
    setFile(null);
    setHealthData(null);
    clearFromLocalStorage();
    setError(null);
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <Upload className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">No file uploaded</h3>
      <p className="mt-1 text-sm text-gray-500">Upload a collectinfo file to get started</p>
    </div>
  );

  const FileHeader = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <FileText className="h-8 w-8 text-blue-600" />
                  <div>
            <h2 className="text-lg font-semibold text-gray-900">{file.name}</h2>
            <p className="text-sm text-gray-500">
              {file.size} bytes • {new Date(file.lastModified).toLocaleString()}
              {healthData?.lastUpdated && (
                <span className="ml-2 text-green-600">
                  • Last processed: {new Date(healthData.lastUpdated).toLocaleString()}
                </span>
              )}
            </p>
          </div>
      </div>
      <div className="flex items-center space-x-2">


        <button
          onClick={replaceFile}
          className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <X className="h-3 w-3 mr-1" />
          Replace
        </button>
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to clear all data? This will remove the current file and all stored data. This action cannot be undone.')) {
              clearFromLocalStorage();
              replaceFile();
              alert('All data cleared successfully');
            }
          }}
          className="inline-flex items-center px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Clear Data
        </button>
      </div>
    </div>
  );

  const UploadSection = () => (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Upload className="h-5 w-5 mr-2 text-blue-600" />
        Upload Collectinfo File
      </h3>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900">
              Drop collectinfo file here, or{' '}
              <span className="text-blue-600 hover:text-blue-500">browse</span>
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              Supports collectinfo files (.tar, .tar.gz, .tgz, .zip, .gz) or files without extensions
            </span>
          </label>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            onChange={handleFileUpload}
          />
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Processing...</h3>
              <div className="mt-1 text-sm text-blue-700">
                Analyzing collectinfo file and extracting health data...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const ClusterOverview = () => {
    const [expandedNamespaces, setExpandedNamespaces] = useState(new Set());

    const toggleNamespace = (namespaceName) => {
      const newExpanded = new Set(expandedNamespaces);
      if (newExpanded.has(namespaceName)) {
        newExpanded.delete(namespaceName);
      } else {
        newExpanded.add(namespaceName);
      }
      setExpandedNamespaces(newExpanded);
    };

    return (
      <div className="space-y-6">
        {/* Cluster Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-blue-600" />
            Cluster Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Cluster Name</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.name || 'N/A'}</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Version</div>
              <div className="text-sm text-gray-900 font-mono">{healthData.clusterInfo?.version || 'N/A'}</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Total Nodes</div>
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
          </div>
          
          {/* Namespace Summary Information */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Replication Factors</div>
              <div className="text-sm text-gray-900">
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(healthData.namespaces?.map(ns => ns.replicationFactor).filter(Boolean) || [])).map((rf, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      RF: {rf}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Health Summary</div>
              <div className="text-sm text-gray-900">
                <div className="flex flex-wrap gap-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    healthData.health?.overall === 'Warning' || healthData.health?.overall === 'Critical' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {healthData.health?.overall || 'Unknown'}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {healthData.health?.passed || 0} Passed
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {healthData.health?.failed || 0} Failed
                  </span>
                </div>
              </div>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
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
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Health Issues Section */}
        {healthData.health?.issues?.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
              Health Issues ({healthData.health.issues.length})
            </h3>
            
            <div className="space-y-3">
              {healthData.health.issues.map((issue, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    {issue}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Aerospike Health Dashboard</h1>
        <p className="text-gray-600">Upload collectinfo files to analyze cluster health and performance</p>
      </div>

      {!healthData ? (
        <div className="space-y-6">
          <UploadSection />
          <EmptyState />
        </div>
      ) : (
        <div className="space-y-6">
          <FileHeader />
          <ClusterOverview />
        </div>
      )}
    </div>
  );
};

export default Dashboard; 