import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Database, Activity, Calendar, Server, Loader2, CheckCircle, XCircle, RefreshCw, Clock, Upload, Plus, ChevronDown, ChevronUp, Search, Trash2, AlertCircle, Download, RotateCcw, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';

const HealthCheckDetails = () => {
  const { healthCheckId } = useParams();
  const navigate = useNavigate();
  const [healthCheckData, setHealthCheckData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState({}); // Track uploading state per region
  
  // UI state for scalability
  const [expandedRegions, setExpandedRegions] = useState({}); // Track which regions are expanded
  const [searchTerm, setSearchTerm] = useState('');
  const [clustersPerPage] = useState(50); // Pagination for large lists
  const [currentPage, setCurrentPage] = useState({});
  const [deletingCluster, setDeletingCluster] = useState(null); // Track which cluster is being deleted
  const [deleteConfirmCluster, setDeleteConfirmCluster] = useState(null); // Confirmation dialog state
  const [uploadNotifications, setUploadNotifications] = useState([]); // Track upload notifications
  const [retryingCluster, setRetryingCluster] = useState(null); // Track which cluster is being retried
  const [showAddRegionDialog, setShowAddRegionDialog] = useState(false); // Track add region dialog
  const [newRegionName, setNewRegionName] = useState(''); // New region name input
  const [addingRegion, setAddingRegion] = useState(false); // Track region creation process

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

    // Check for duplicates
    const region = regions.find(r => r.region_name === regionName);
    const existingFilenames = region?.clusters?.map(c => c.filename) || [];
    
    const filesToUpload = [];
    const duplicateFiles = [];
    const notifications = [];

    Array.from(files).forEach(file => {
      if (existingFilenames.includes(file.name)) {
        duplicateFiles.push(file.name);
        notifications.push({
          id: Date.now() + Math.random(),
          type: 'warning',
          message: `File "${file.name}" already exists in region "${regionName}"`,
          timestamp: new Date()
        });
      } else {
        filesToUpload.push(file);
      }
    });

    // Show notifications for duplicates
    if (notifications.length > 0) {
      setUploadNotifications(prev => [...prev, ...notifications]);
      // Auto-remove notifications after 5 seconds
      setTimeout(() => {
        setUploadNotifications(prev => 
          prev.filter(n => !notifications.some(newN => newN.id === n.id))
        );
      }, 5000);
    }

    // If no files to upload (all duplicates), return early
    if (filesToUpload.length === 0) {
      return;
    }

    setUploading(prev => ({ ...prev, [regionName]: true }));

    try {
      const formData = new FormData();
      
      // Add only non-duplicate files
      filesToUpload.forEach(file => {
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

      // Show success notification
      if (filesToUpload.length > 0) {
        const successNotification = {
          id: Date.now() + Math.random(),
          type: 'success',
          message: `Successfully uploaded ${filesToUpload.length} file(s) to region "${regionName}"`,
          timestamp: new Date()
        };
        setUploadNotifications(prev => [...prev, successNotification]);
        
        // Auto-remove success notification after 3 seconds
        setTimeout(() => {
          setUploadNotifications(prev => prev.filter(n => n.id !== successNotification.id));
        }, 3000);
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

  // Helper functions for scalable UI
  const toggleRegion = (regionName) => {
    setExpandedRegions(prev => ({
      ...prev,
      [regionName]: !prev[regionName]
    }));
  };

  const filterAndSortClusters = (clusters) => {
    // First filter by search term
    const filtered = clusters.filter(cluster => {
      const matchesSearch = !searchTerm || 
        cluster.cluster_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cluster.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cluster.data?.clusterInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    // Then sort by memory used (highest to lowest)
    return filtered.sort((a, b) => {
      const getMemoryValue = (cluster) => {
        const memoryUsed = cluster.data?.clusterInfo?.memory?.used;
        if (!memoryUsed || memoryUsed === 'Unknown' || memoryUsed === 'Error') return 0;
        // Parse numeric values from strings like "30.5 GB", "1.2 TB", etc.
        const numericValue = parseFloat(memoryUsed.replace(/[^0-9.]/g, ''));
        // Handle different units - convert everything to GB for comparison
        if (memoryUsed.includes('TB')) {
          return isNaN(numericValue) ? 0 : numericValue * 1024; // TB to GB
        }
        return isNaN(numericValue) ? 0 : numericValue; // Already in GB
      };
      
      return getMemoryValue(b) - getMemoryValue(a); // Descending order (highest first)
    });
  };

  const paginateClusters = (clusters, regionName) => {
    const page = currentPage[regionName] || 1;
    const startIndex = (page - 1) * clustersPerPage;
    const endIndex = startIndex + clustersPerPage;
    return {
      clusters: clusters.slice(startIndex, endIndex),
      totalPages: Math.ceil(clusters.length / clustersPerPage),
      currentPage: page,
      totalCount: clusters.length
    };
  };

  const setRegionPage = (regionName, page) => {
    setCurrentPage(prev => ({
      ...prev,
      [regionName]: page
    }));
  };

  const handleDeleteCluster = async (resultKey, clusterName) => {
    setDeletingCluster(resultKey);
    try {
      const response = await fetch(`/api/health-checks/clusters/${resultKey}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the health check data to reflect the deletion
        await fetchHealthCheckDetails(false);
        alert(`Cluster "${clusterName}" deleted successfully`);
      } else {
        const errorData = await response.json();
        alert(`Failed to delete cluster: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting cluster:', error);
      alert('Error deleting cluster. Please try again.');
    } finally {
      setDeletingCluster(null);
      setDeleteConfirmCluster(null);
    }
  };

  const confirmDeleteCluster = (cluster) => {
    setDeleteConfirmCluster(cluster);
  };

  const cancelDeleteCluster = () => {
    setDeleteConfirmCluster(null);
  };

  const exportLicenseInfo = () => {
    const exportData = [];
    let sno = 1;

    regions.forEach(region => {
      region.clusters?.forEach(cluster => {
        const clusterData = cluster.data;
        const realClusterName = clusterData?.clusterInfo?.name || cluster.cluster_name;
        const namespaceCount = clusterData?.namespaces?.length || 0;
        
        // Calculate total used memory
        const totalUsedMemory = clusterData?.clusterInfo?.memory?.used || '0 GB';
        const usedMemoryValue = parseFloat(totalUsedMemory.replace(/[^0-9.]/g, '')) || 0;
        
        // Calculate unique data (sum from all namespaces)
        const uniqueData = clusterData?.namespaces?.reduce((total, ns) => {
          const uniqueValue = parseFloat(ns.clientWrites?.uniqueData?.replace(/[^0-9.]/g, '') || 0);
          return total + uniqueValue;
        }, 0) || 0;

        exportData.push({
          'S.No': sno++,
          'Region': region.region_name || '',
          'Collectinfo Filename': cluster.filename || '',
          'Cluster Name': realClusterName,
          'Namespace Count': namespaceCount, // Keep as number
          'Total Used Memory (GB)': usedMemoryValue, // Keep as number
          'Unique Data (GB)': uniqueData // Keep as number
        });
      });
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add summary rows with formulas
    const dataRowCount = exportData.length;
    const summaryStartRow = dataRowCount + 2; // Leave one empty row
    
    // Add empty row
    XLSX.utils.sheet_add_aoa(ws, [[]], { origin: `A${dataRowCount + 2}` });
    
    // Add summary header
    XLSX.utils.sheet_add_aoa(ws, [['TOTALS:']], { origin: `A${summaryStartRow + 1}` });
    
    // Add formula rows
    const formulas = [
      ['', '', '', 'Total Namespace Count:', { f: `SUM(E2:E${dataRowCount + 1})` }, '', ''],
      ['', '', '', 'Total Used Memory (GB):', '', { f: `SUM(F2:F${dataRowCount + 1})` }, ''],
      ['', '', '', 'Total Unique Data (GB):', '', '', { f: `SUM(G2:G${dataRowCount + 1})` }]
    ];
    
    XLSX.utils.sheet_add_aoa(ws, formulas, { origin: `A${summaryStartRow + 2}` });

    // Set column widths for better readability
    const colWidths = [
      { wch: 8 },   // S.No
      { wch: 15 },  // Region
      { wch: 30 },  // Collectinfo Filename
      { wch: 25 },  // Cluster Name
      { wch: 18 },  // Namespace Count
      { wch: 22 },  // Total Used Memory
      { wch: 18 }   // Unique Data
    ];
    ws['!cols'] = colWidths;

    // Style the summary section (make it bold)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = summaryStartRow; row <= summaryStartRow + 4; row++) {
      for (let col = 0; col <= 6; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;
        
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.font = { bold: true };
        
        // Add background color to total row
        if (row >= summaryStartRow + 2) {
          ws[cellAddress].s.fill = { fgColor: { rgb: "E6F3FF" } };
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'License Info');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `license-info-${healthCheckData?.customer_name || 'export'}-${timestamp}.xlsx`;

    // Download the file
    XLSX.writeFile(wb, filename);

    // Show success notification
    const successNotification = {
      id: Date.now() + Math.random(),
      type: 'success',
      message: `License info exported successfully as ${filename}`,
      timestamp: new Date()
    };
    setUploadNotifications(prev => [...prev, successNotification]);
    
    // Auto-remove notification after 3 seconds
    setTimeout(() => {
      setUploadNotifications(prev => prev.filter(n => n.id !== successNotification.id));
    }, 3000);
  };

  const handleViewCluster = (resultKey) => {
    navigate(`/health-check/${healthCheckId}/cluster/${resultKey}`);
  };

  const handleRetryCluster = async (resultKey) => {
    try {
      setRetryingCluster(resultKey);
      
      const response = await fetch(`http://localhost:8000/health-checks/${healthCheckId}/retry/${resultKey}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh data to show updated status
        fetchHealthCheckDetails(true);
        
        // Show success notification
        const successNotification = {
          id: Date.now(),
          type: 'success',
          message: `Retry started for cluster`,
          timestamp: new Date()
        };
        setUploadNotifications(prev => [...prev, successNotification]);
        
        // Auto-remove notification after 3 seconds
        setTimeout(() => {
          setUploadNotifications(prev => prev.filter(n => n.id !== successNotification.id));
        }, 3000);
      } else {
        alert(`Failed to retry cluster: ${data.message}`);
      }
    } catch (error) {
      console.error('Error retrying cluster:', error);
      alert('Failed to retry cluster');
    } finally {
      setRetryingCluster(null);
    }
  };

  const handleAddNewRegion = async () => {
    if (!newRegionName.trim()) {
      alert('Please enter a region name');
      return;
    }

    try {
      setAddingRegion(true);
      
      // Create a placeholder cluster for the new region
      const response = await fetch(`http://localhost:8000/health-checks/${healthCheckId}/add-region`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          region_name: newRegionName.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh data to show the new region
        fetchHealthCheckDetails(true);
        
        // Reset dialog state
        setShowAddRegionDialog(false);
        setNewRegionName('');
        
        // Show success notification
        const successNotification = {
          id: Date.now(),
          type: 'success',
          message: `New region "${newRegionName.trim()}" added successfully`,
          timestamp: new Date()
        };
        setUploadNotifications(prev => [...prev, successNotification]);
        
        // Auto-remove notification after 3 seconds
        setTimeout(() => {
          setUploadNotifications(prev => prev.filter(n => n.id !== successNotification.id));
        }, 3000);
      } else {
        alert(`Failed to add region: ${data.message}`);
      }
    } catch (error) {
      console.error('Error adding region:', error);
      alert('Failed to add region');
    } finally {
      setAddingRegion(false);
    }
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
      case 'partial':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: 'Partial Data',
          color: 'bg-yellow-100 text-yellow-800',
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
    let totalUsedMemory = 0;
    let totalUniqueData = 0;
    let totalNamespaces = 0;
    let healthIssues = 0;

    clusters.forEach(cluster => {
      const data = cluster.data;
      
      // Calculate total used memory (sum of used memory across clusters)
      if (data && data.clusterInfo && data.clusterInfo.memory) {
        const memoryUsed = data.clusterInfo.memory.used;
        if (memoryUsed) {
          const numericValue = parseFloat(memoryUsed.replace(/[^0-9.]/g, ''));
          if (!isNaN(numericValue)) {
            totalUsedMemory += numericValue;
          }
        }
      }
      
      // Count namespaces and sum unique data
      if (data && data.namespaces && Array.isArray(data.namespaces)) {
        totalNamespaces += data.namespaces.length;
        
        // Sum unique data from all namespaces
        data.namespaces.forEach(ns => {
          if (ns.clientWrites && ns.clientWrites.uniqueData) {
            const uniqueValue = parseFloat(ns.clientWrites.uniqueData.replace(/[^0-9.]/g, ''));
            if (!isNaN(uniqueValue)) {
              totalUniqueData += uniqueValue;
            }
          }
        });
      }

      // Count health issues
      if (data && data.health && data.health.issues && Array.isArray(data.health.issues)) {
        healthIssues += data.health.issues.length;
      }
    });

    return {
      totalClusters: clusters.length,
      totalUsedMemory: totalUsedMemory.toFixed(1),
      totalUniqueData: totalUniqueData.toFixed(1),
      totalNamespaces,
      healthIssues
    };
  };

  // Calculate overall summary across all regions
  const calculateOverallSummary = () => {
    let totalUsedMemory = 0;
    let totalUniqueData = 0;
    let totalNamespaces = 0;
    let totalClusters = 0;
    
    regions.forEach(region => {
      const regionSummary = calculateRegionSummary(region);
      totalUsedMemory += parseFloat(regionSummary.totalUsedMemory);
      totalUniqueData += parseFloat(regionSummary.totalUniqueData);
      totalNamespaces += regionSummary.totalNamespaces;
      totalClusters += regionSummary.totalClusters;
    });
    
    return {
      totalUsedMemory: totalUsedMemory.toFixed(1),
      totalUniqueData: totalUniqueData.toFixed(1),
      totalNamespaces,
      totalClusters
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
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{health_check.customer_name}</h1>
              {/* <p className="text-gray-600">Multi-region health check analysis</p> */}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center p-1.5 border border-gray-300 shadow-sm rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={refreshing ? 'Refreshing...' : 'Refresh data'}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportLicenseInfo}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Export License Info
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {(() => {
        const overallSummary = calculateOverallSummary();
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="card text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.total_regions}</div>
              <div className="text-sm text-gray-600">Regions</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{overallSummary.totalClusters}</div>
              <div className="text-sm text-gray-600">Clusters</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-orange-600">{overallSummary.totalNamespaces}</div>
              <div className="text-sm text-gray-600">Namespaces</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-purple-600">{overallSummary.totalUsedMemory} GB</div>
              <div className="text-sm text-gray-600">Used Memory</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-indigo-600">{overallSummary.totalUniqueData} GB</div>
              <div className="text-sm text-gray-600">Unique Data</div>
            </div>
            <div className="card text-center">
              <div className="text-sm text-gray-600 mb-1">Created</div>
              <div className="text-sm font-medium text-gray-900">
                {formatDate(health_check.created_at)}
              </div>
            </div>
          </div>
        );
      })()}



      {/* Upload Notifications */}
      {uploadNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {uploadNotifications.map(notification => (
            <div
              key={notification.id}
              className={`max-w-sm p-4 rounded-lg shadow-lg border ${
                notification.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              } animate-in slide-in-from-right duration-300`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{notification.message}</p>
                </div>
                <button
                  onClick={() => {
                    setUploadNotifications(prev => prev.filter(n => n.id !== notification.id));
                  }}
                  className="ml-auto flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Regions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Regions</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clusters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 w-64 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {regions.map((region, index) => {
          const regionSummary = calculateRegionSummary(region);
          const filteredAndSortedClusters = filterAndSortClusters(region.clusters || []);
          const paginatedData = paginateClusters(filteredAndSortedClusters, region.region_name);
          const isExpanded = expandedRegions[region.region_name] ?? false;
          
          return (
            <div key={index} className="border border-gray-200 rounded-lg bg-white shadow-sm">
              {/* Region Header - Always Visible */}
              <div 
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleRegion(region.region_name)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{region.region_name}</h3>
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-600">
                    <span>{regionSummary.totalClusters} clusters</span>
                    <span>{regionSummary.totalNamespaces} namespaces</span>
                    <span>{regionSummary.totalUsedMemory} GB used memory</span>
                    <span>{regionSummary.totalUniqueData} GB unique data</span>
                    
                    {/* Status breakdown */}
                    <div className="flex gap-2">
                      {['waiting', 'processing', 'completed', 'failed'].map(status => {
                        const count = (region.clusters || []).filter(c => c.status === status).length;
                        if (count > 0) {
                          return (
                            <span key={status} className={`px-2 py-1 rounded-full text-xs font-medium ${
                              status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                              status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800 border border-red-300 shadow-sm'
                            }`}>
                              {status === 'failed' && '⚠️ '}
                              {count} {status}
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
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
                        Add Files
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Clusters Section */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-4">
                  {/* Pagination Info */}
                  {paginatedData.totalCount > clustersPerPage && (
                    <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                      <span>
                        Showing {((paginatedData.currentPage - 1) * clustersPerPage) + 1} to{' '}
                        {Math.min(paginatedData.currentPage * clustersPerPage, paginatedData.totalCount)} of{' '}
                        {paginatedData.totalCount} clusters
                      </span>
                      {paginatedData.totalPages > 1 && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRegionPage(region.region_name, Math.max(1, paginatedData.currentPage - 1))}
                            disabled={paginatedData.currentPage === 1}
                            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Previous
                          </button>
                          <span className="px-3 py-1 text-sm">
                            Page {paginatedData.currentPage} of {paginatedData.totalPages}
                          </span>
                          <button
                            onClick={() => setRegionPage(region.region_name, Math.min(paginatedData.totalPages, paginatedData.currentPage + 1))}
                            disabled={paginatedData.currentPage === paginatedData.totalPages}
                            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clusters Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedData.clusters.map((cluster, clusterIndex) => {
                    const clusterData = cluster.data;
                    const statusInfo = getClusterStatusInfo(cluster);
                    
                    // Extract cluster information for display
                    const realClusterName = clusterData?.clusterInfo?.name || cluster.cluster_name;
                    const totalMemory = clusterData?.clusterInfo?.memory?.total || 'N/A';
                    const memoryUsed = clusterData?.clusterInfo?.memory?.used || 'N/A';
                    const namespaceCount = clusterData?.namespaces?.length || 0;
                    
                    // Check if this is an error cluster (either status failed/partial or shows "Error"/"Unknown" in data)
                    const isErrorCluster = cluster.status === 'failed' || 
                                          cluster.status === 'partial' ||
                                          realClusterName === 'Error' || 
                                          totalMemory === 'Error' || 
                                          totalMemory === 'Unknown' ||
                                          memoryUsed === 'Error' || 
                                          memoryUsed === 'Unknown';
                    
                    // Calculate unique memory used (sum of all namespace unique data)
                    const uniqueMemoryUsed = clusterData?.namespaces?.reduce((total, ns) => {
                      const uniqueData = parseFloat(ns.clientWrites?.uniqueData?.replace(/[^\d.]/g, '') || 0);
                      return total + uniqueData;
                    }, 0).toFixed(2) + ' GB' || 'N/A';
                    
                    return (
                      <div 
                        key={clusterIndex} 
                        className={`border-2 rounded-lg p-4 transition-colors ${
                          isErrorCluster
                            ? 'border-red-300 bg-red-50 hover:bg-red-100 shadow-sm' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        } ${statusInfo.canView ? 'cursor-pointer' : 'cursor-default'}`}
                        onClick={() => statusInfo.canView && handleViewCluster(cluster.result_key)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h5 className={`font-medium ${isErrorCluster ? 'text-red-700' : 'text-gray-900'}`}>
                                {realClusterName}
                              </h5>
                              {/* Status Dot */}
                              <div className="flex items-center">
                                {isErrorCluster ? (
                                  <div className="flex items-center">
                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" title="Error"></div>
                                    <span className="ml-2 text-xs font-medium text-red-600 bg-white px-2 py-0.5 rounded border border-red-200">ERROR</span>
                                  </div>
                                ) : (
                                  <>
                                    {cluster.status === 'completed' && (
                                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Completed"></div>
                                    )}
                                    {cluster.status === 'partial' && (
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Partial Data - Parsing Issues"></div>
                                    )}
                                    {cluster.status === 'processing' && (
                                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Processing"></div>
                                    )}
                                    {cluster.status === 'waiting' && (
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Waiting"></div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <p className={`text-xs ${isErrorCluster ? 'text-red-600' : 'text-gray-500'}`}>
                              {cluster.filename}
                            </p>
                          </div>
                                                    <div className="flex items-center space-x-2">
                            {retryingCluster === cluster.result_key ? (
                              <div className="flex items-center px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-md border border-blue-200">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Retrying...
                              </div>
                            ) : (
                              <>
                                {isErrorCluster && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetryCluster(cluster.result_key);
                                    }}
                                    disabled={deletingCluster === cluster.result_key}
                                    className="p-2 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors disabled:opacity-50 border border-blue-200"
                                    title="Retry processing"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDeleteCluster(cluster);
                                  }}
                                  disabled={deletingCluster === cluster.result_key}
                                  className="p-2 rounded-md bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50 border border-gray-200"
                                  title="Delete cluster"
                                >
                                  {deletingCluster === cluster.result_key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
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
                                                        {isErrorCluster && (
                              <div className="mt-2 pt-2 border-t border-red-200">
                                <div className="text-red-600 font-medium text-xs mb-2">⚠️ Parsing errors detected</div>
                                {retryingCluster === cluster.result_key ? (
                                  <div className="w-full flex items-center justify-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Retrying...
                                  </div>
                                ) : deletingCluster === cluster.result_key ? (
                                  <div className="w-full flex items-center justify-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Deleting...
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetryCluster(cluster.result_key);
                                    }}
                                    className="w-full inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Retry Processing
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`text-xs text-center py-3 ${
                            cluster.status === 'failed' 
                              ? 'text-red-600 bg-red-100 border border-red-200 rounded-md' 
                              : 'text-gray-500'
                          }`}>
                            {cluster.status === 'waiting' ? 'Waiting for file upload...' :
                             cluster.status === 'processing' ? 'Analyzing collectinfo...' :
                             cluster.status === 'failed' ? (
                               <div>
                                 <div className="font-medium">❌ Processing Failed</div>
                                 <div className="mt-1 text-xs">{cluster.error || 'Unknown error'}</div>
                                 {retryingCluster === cluster.result_key ? (
                                   <div className="mt-2 inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded">
                                     <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                     Retrying...
                                   </div>
                                 ) : deletingCluster === cluster.result_key ? (
                                   <div className="mt-2 inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded">
                                     <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                     Deleting...
                                   </div>
                                 ) : (
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleRetryCluster(cluster.result_key);
                                     }}
                                     className="mt-2 inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200"
                                   >
                                     <RotateCcw className="h-3 w-3 mr-1" />
                                     Retry
                                   </button>
                                 )}
                               </div>
                             ) :
                             'Waiting for processing'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          );
        })}
        
        {/* Add Region Button - Bottom Center */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setShowAddRegionDialog(true)}
            className="inline-flex items-center px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Region
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmCluster && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Cluster
                </h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete the cluster <strong>"{deleteConfirmCluster.data?.clusterInfo?.name || deleteConfirmCluster.cluster_name}"</strong>? 
                This action cannot be undone and will permanently remove all health check data for this cluster.
              </p>
              <div className="mt-2 text-xs text-gray-400">
                File: {deleteConfirmCluster.filename}
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteCluster}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCluster(deleteConfirmCluster.result_key, deleteConfirmCluster.data?.clusterInfo?.name || deleteConfirmCluster.cluster_name)}
                disabled={deletingCluster === deleteConfirmCluster.result_key}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingCluster === deleteConfirmCluster.result_key ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Region Dialog */}
      {showAddRegionDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4 text-center">Add New Region</h3>
              <div className="mt-4 px-7 py-3">
                <p className="text-sm text-gray-500 mb-4 text-center">
                  Enter a name for the new region. You can upload cluster files to this region after it's created.
                </p>
                <input
                  type="text"
                  value={newRegionName}
                  onChange={(e) => setNewRegionName(e.target.value)}
                  placeholder="Enter region name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !addingRegion) {
                      handleAddNewRegion();
                    }
                  }}
                  disabled={addingRegion}
                />
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowAddRegionDialog(false);
                      setNewRegionName('');
                    }}
                    disabled={addingRegion}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNewRegion}
                    disabled={addingRegion || !newRegionName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {addingRegion ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                        Adding...
                      </>
                    ) : (
                      'Add Region'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthCheckDetails; 