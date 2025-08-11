import React, { useState } from 'react';
import { Plus, Trash2, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateHealthCheck = () => {
  const [customerName, setCustomerName] = useState('');
  const [regions, setRegions] = useState([{ name: '', files: [] }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const addRegion = () => {
    setRegions([...regions, { name: '', files: [] }]);
  };

  const removeRegion = (regionIndex) => {
    if (regions.length > 1) {
      setRegions(regions.filter((_, index) => index !== regionIndex));
    }
  };

  const updateRegionName = (regionIndex, name) => {
    const updatedRegions = [...regions];
    updatedRegions[regionIndex].name = name;
    setRegions(updatedRegions);
  };

  const updateFiles = (regionIndex, fileList) => {
    const updatedRegions = [...regions];
    updatedRegions[regionIndex].files = Array.from(fileList);
    setRegions(updatedRegions);
  };

  const removeFile = (regionIndex, fileIndex) => {
    const updatedRegions = [...regions];
    updatedRegions[regionIndex].files = updatedRegions[regionIndex].files.filter(
      (_, index) => index !== fileIndex
    );
    setRegions(updatedRegions);
  };

  const getTotalFiles = () => {
    return regions.reduce((total, region) => total + region.files.length, 0);
  };

  const validateForm = () => {
    if (!customerName.trim()) {
      setError('Customer name is required');
      return false;
    }

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      if (!region.name.trim()) {
        setError(`Region ${i + 1} name is required`);
        return false;
      }

      if (region.files.length === 0) {
        setError(`At least one collectinfo file is required for region "${region.name}"`);
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // First, create the health check
      const regionsData = regions.map(region => ({
        region_name: region.name,
        file_count: region.files.length
      }));

      const createResponse = await fetch('http://localhost:8000/health-checks/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer_name: customerName,
          regions_data: JSON.stringify(regionsData)
        })
      });

      const createData = await createResponse.json();
      
      if (!createData.success) {
        throw new Error(createData.message || 'Failed to create health check');
      }

      const healthCheckId = createData.health_check_id;

      // Then upload files for each region
      for (const region of regions) {
        const formData = new FormData();
        
        // Add files
        region.files.forEach(file => {
          formData.append('files', file);
        });
        
        // Add metadata
        formData.append('region_name', region.name);

        const uploadResponse = await fetch(`http://localhost:8000/health-checks/${healthCheckId}/upload`, {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadResponse.json();
        
        if (!uploadData.success) {
          throw new Error(`Failed to upload files for region ${region.name}: ${uploadData.message}`);
        }
      }

      // Navigate to the health check details page
      navigate(`/health-check/${healthCheckId}`);

    } catch (err) {
      setError(err.message || 'Failed to create health check');
      console.error('Error creating health check:', err);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Health Check</h1>
          <p className="mt-2 text-gray-600">
            Create a new multi-region health check by uploading collectinfo files. 
            Cluster names will be automatically extracted from the files.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Customer Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Name *
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter customer name..."
          />
        </div>

        {/* Regions & Files */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Regions & Collectinfo Files</h2>
            <div className="text-sm text-gray-500">
              {regions.length} regions, {getTotalFiles()} files
            </div>
          </div>

          <div className="space-y-6">
            {regions.map((region, regionIndex) => (
              <div key={regionIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1 mr-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region Name
                    </label>
                    <input
                      type="text"
                      value={region.name}
                      onChange={(e) => updateRegionName(regionIndex, e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., US-East, Europe, Asia-Pacific..."
                    />
                  </div>
                  <button
                    onClick={() => removeRegion(regionIndex)}
                    disabled={regions.length === 1}
                    className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Collectinfo Files in this region */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Collectinfo Files</h3>
                  <p className="text-xs text-gray-500">
                    Select multiple collectinfo files for this region. Cluster names will be automatically detected.
                  </p>
                  
                  {/* File Selection */}
                  <div className="bg-white p-3 rounded border">
                    <div className="relative">
                      <input
                        type="file"
                        accept=".tar,.tar.gz,.tgz,.zip,.gz,*"
                        multiple
                        onChange={(e) => updateFiles(regionIndex, e.target.files)}
                        className="hidden"
                        id={`files-${regionIndex}`}
                      />
                      <label
                        htmlFor={`files-${regionIndex}`}
                        className="cursor-pointer inline-flex items-center px-4 py-3 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full justify-center"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {region.files.length > 0 
                          ? `${region.files.length} file${region.files.length > 1 ? 's' : ''} selected`
                          : 'Choose collectinfo files (multiple selection)'
                        }
                      </label>
                      {region.files.length > 0 && (
                        <CheckCircle className="absolute -right-2 -top-2 h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {region.files.length > 0 && (
                    <div className="bg-gray-50 p-3 rounded border">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Selected Files:</h4>
                      <div className="space-y-1">
                        {region.files.map((file, fileIndex) => (
                          <div key={fileIndex} className="flex items-center justify-between bg-white px-2 py-1 rounded text-xs">
                            <span className="text-gray-700 truncate">{file.name}</span>
                            <button
                              onClick={() => removeFile(regionIndex, fileIndex)}
                              className="ml-2 text-red-600 hover:text-red-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={addRegion}
              className="inline-flex items-center px-4 py-2 border border-dashed border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Region
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/health-checks')}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Health Check
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateHealthCheck; 