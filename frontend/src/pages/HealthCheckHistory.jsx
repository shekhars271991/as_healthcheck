import React, { useState, useEffect } from 'react';
import { Plus, Clock, Users, Database, Eye, Calendar, Activity, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HealthCheckHistory = () => {
  const [healthChecks, setHealthChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, customerName }
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHealthCheckHistory();
  }, []);

  const fetchHealthCheckHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/health-checks');
      const data = await response.json();
      
      if (data.success) {
        setHealthChecks(data.health_checks);
      } else {
        setError(data.message || 'Failed to fetch health check history');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Error fetching health checks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewHealthCheck = () => {
    navigate('/health-check/create');
  };

  const handleViewHealthCheck = (healthCheckId) => {
    navigate(`/health-check/${healthCheckId}`);
  };

  const handleDeleteHealthCheck = (healthCheck) => {
    setDeleteConfirm({
      id: healthCheck.id,
      customerName: healthCheck.customer_name
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      const response = await fetch(`http://localhost:8000/health-checks/${deleteConfirm.id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the deleted health check from the list
        setHealthChecks(healthChecks.filter(hc => hc.id !== deleteConfirm.id));
        setDeleteConfirm(null);
      } else {
        setError(data.message || 'Failed to delete health check');
      }
    } catch (err) {
      setError('Failed to delete health check');
      console.error('Error deleting health check:', err);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <Activity className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No health checks yet</h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by creating your first multi-region health check.
      </p>
      <div className="mt-6">
        <button
          onClick={handleCreateNewHealthCheck}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Health Check
        </button>
      </div>
    </div>
  );

  const LoadingState = () => (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-sm text-gray-500">Loading health check history...</p>
    </div>
  );

  const ErrorState = () => (
    <div className="text-center py-12">
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-700">{error}</div>
        <button
          onClick={fetchHealthCheckHistory}
          className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
        >
          Try again
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Check History</h1>
          <p className="text-gray-600">View and manage your multi-region Aerospike health checks</p>
        </div>
        <button
          onClick={handleCreateNewHealthCheck}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Health Check
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState />}
      {!loading && !error && healthChecks.length === 0 && <EmptyState />}
      
      {!loading && !error && healthChecks.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {healthChecks.map((healthCheck) => (
              <li key={healthCheck.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {healthCheck.customer_name}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(healthCheck.status)}`}>
                          {healthCheck.status}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(healthCheck.created_at)}
                        </div>
                        <div className="flex items-center">
                          <Database className="h-4 w-4 mr-1" />
                          {healthCheck.regions_count} regions
                        </div>
                        <div className="flex items-center">
                          <Activity className="h-4 w-4 mr-1" />
                          {healthCheck.clusters_count} clusters
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewHealthCheck(healthCheck.id)}
                      disabled={!healthCheck.id}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </button>
                    <button
                      onClick={() => handleDeleteHealthCheck(healthCheck)}
                      disabled={!healthCheck.id}
                      className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">Delete Health Check</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete the health check for <strong>{deleteConfirm.customerName}</strong>? 
                  This action cannot be undone and will remove all associated cluster data.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={cancelDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete'
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

export default HealthCheckHistory; 