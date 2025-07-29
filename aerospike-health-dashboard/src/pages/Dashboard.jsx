import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Database, 
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  RefreshCw
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
    
    if (savedFile && savedHealthData) {
      try {
        const parsedFile = JSON.parse(savedFile);
        const parsedHealthData = JSON.parse(savedHealthData);
        
        // Recreate file object from saved data
        const fileObj = new File([parsedFile.content], parsedFile.name, {
          type: parsedFile.type,
          lastModified: parsedFile.lastModified
        });
        
        setFile(fileObj);
        setHealthData(parsedHealthData);
        logger.info('Restored data from localStorage', { 
          filename: parsedFile.name,
          dataSize: Object.keys(parsedHealthData).length 
        });
      } catch (err) {
        logger.error('Failed to restore data from localStorage', err);
        // Clear corrupted data
        localStorage.removeItem('aerospike_health_file');
        localStorage.removeItem('aerospike_health_data');
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
    logger.info('Data cleared from localStorage');
  };

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    console.log('File upload event:', event.target.files); // Debug log
    
    if (uploadedFile) {
      console.log('File selected:', uploadedFile.name, uploadedFile.type, uploadedFile.size); // Debug log
      
      // Accept text files and files with health report in name
      const fileName = uploadedFile.name.toLowerCase();
      const isValidFile = fileName.includes('health') || 
                         fileName.includes('report') || 
                         fileName.endsWith('.txt') ||
                         fileName.endsWith('.log');
      
      if (isValidFile) {
        setFile(uploadedFile);
        setError(null);
        logger.info('Health report file uploaded', { 
          filename: uploadedFile.name,
          size: uploadedFile.size 
        });
        
        // Process the file immediately
        await processHealthReport(uploadedFile);
      } else {
        setError('Please select a valid health report text file (.txt files or files with "health" or "report" in name)');
        setFile(null);
      }
    } else {
      console.log('No file selected'); // Debug log
      setError('No file was selected. Please try again.');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add('border-primary-500', 'bg-primary-50');
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-primary-500', 'bg-primary-50');
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-primary-500', 'bg-primary-50');
    
    const files = event.dataTransfer.files;
    console.log('Files dropped:', files); // Debug log
    
    if (files.length > 0) {
      const droppedFile = files[0];
      console.log('File dropped:', droppedFile.name, droppedFile.type, droppedFile.size); // Debug log
      
      // Use the same validation logic
      const fileName = droppedFile.name.toLowerCase();
      const isValidFile = fileName.includes('health') || 
                         fileName.includes('report') || 
                         fileName.endsWith('.txt') ||
                         fileName.endsWith('.log');
      
      if (isValidFile) {
        setFile(droppedFile);
        setError(null);
        logger.info('Health report file dropped', { 
          filename: droppedFile.name,
          size: droppedFile.size 
        });
        
        // Process the file immediately
        await processHealthReport(droppedFile);
      } else {
        setError('Please select a valid health report text file (.txt files or files with "health" or "report" in name)');
        setFile(null);
      }
    } else {
      setError('No file was dropped. Please try again.');
    }
  };

  const processHealthReport = async (file) => {
    setIsProcessing(true);
    setError(null);
    logger.info('Processing health report file');

    try {
      const text = await file.text();
      const parsedData = parseHealthReport(text);
      
      setHealthData(parsedData);
      
      // Save to localStorage
      saveToLocalStorage(file, parsedData);
      
      logger.info('Health report processed successfully', parsedData);
    } catch (err) {
      setError('Failed to process health report. Please try again.');
      logger.error('Health report processing failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseHealthReport = (text) => {
    // Parse the health report text and extract structured data
    const lines = text.split('\n');
    const data = {
      overallHealth: 'unknown',
      nodeCount: 0,
      activeConnections: 0,
      cacheHitRate: 0,
      latency: 0,
      issues: 0,
      warnings: 0,
      lastUpdated: new Date().toISOString(),
      rawText: text,
      sections: {
        summary: [],
        health: [],
        performance: [],
        configuration: [],
        systemInfo: [],
        xdrStatus: [],
        logs: []
      }
    };

    let currentSection = 'summary';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Detect sections
      if (line.toLowerCase().includes('health') && line.toLowerCase().includes('check')) {
        currentSection = 'health';
      } else if (line.toLowerCase().includes('performance') || line.toLowerCase().includes('stat')) {
        currentSection = 'performance';
      } else if (line.toLowerCase().includes('config') || line.toLowerCase().includes('setting')) {
        currentSection = 'configuration';
      } else if (line.toLowerCase().includes('system') || line.toLowerCase().includes('info')) {
        currentSection = 'systemInfo';
      } else if (line.toLowerCase().includes('xdr') || line.toLowerCase().includes('cross')) {
        currentSection = 'xdrStatus';
      } else if (line.toLowerCase().includes('log') || line.toLowerCase().includes('error')) {
        currentSection = 'logs';
      }
      
      // Add line to current section
      if (data.sections[currentSection]) {
        data.sections[currentSection].push(line);
      }
      
      // Extract specific metrics
      if (line.toLowerCase().includes('healthy') || line.toLowerCase().includes('ok')) {
        data.overallHealth = 'healthy';
      } else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('issue')) {
        data.overallHealth = 'warning';
        data.warnings++;
      } else if (line.toLowerCase().includes('error') || line.toLowerCase().includes('critical')) {
        data.overallHealth = 'critical';
        data.issues++;
      }
      
      // Extract numeric values
      if (line.includes('nodes') || line.includes('node')) {
        const match = line.match(/(\d+)/);
        if (match) data.nodeCount = parseInt(match[1]);
      }
      
      if (line.includes('connection') || line.includes('client')) {
        const match = line.match(/(\d+)/);
        if (match) data.activeConnections = parseInt(match[1]);
      }
      
      if (line.includes('cache') || line.includes('hit')) {
        const match = line.match(/(\d+(?:\.\d+)?)/);
        if (match) data.cacheHitRate = parseFloat(match[1]);
      }
      
      if (line.includes('latency') || line.includes('ms')) {
        const match = line.match(/(\d+(?:\.\d+)?)/);
        if (match) data.latency = parseFloat(match[1]);
      }
    }

    return data;
  };

  const replaceFile = () => {
    setFile(null);
    setHealthData(null);
    setError(null);
    
    // Clear from localStorage
    clearFromLocalStorage();
  };

  const EmptyState = () => (
    <div className="text-center py-12">
      <Database className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No health data</h3>
      <p className="mt-1 text-sm text-gray-500">Upload a health report file to get started.</p>
    </div>
  );

  const FileHeader = () => (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-gray-500 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-gray-900">Current File</h3>
            <p className="text-sm text-gray-500">{file.name}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={replaceFile}
            className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Replace File
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
                replaceFile();
              }
            }}
            className="inline-flex items-center px-3 py-1 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Data
          </button>
        </div>
      </div>
    </div>
  );

  const UploadSection = () => (
    <div className="card">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Upload Health Report</h3>
        <p className="mt-1 text-sm text-gray-500">
          Select your Aerospike health report text file to analyze cluster health
        </p>
      </div>

      <div className="mt-6">
        <div className="flex justify-center">
          <div className="w-full max-w-lg">
            <label 
              className="flex w-full cursor-pointer appearance-none items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-white px-6 py-4 outline-none transition hover:border-gray-400 focus:border-primary-500 focus:outline-none"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-1 text-center">
                <FileText className="mx-auto h-6 w-6 text-gray-400" />
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-primary-600 hover:text-primary-500">
                    Click to upload
                  </span>{' '}
                  or drag and drop
                </div>
                <p className="text-xs text-gray-500">Health report text files (.txt)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".txt,.log"
                onChange={handleFileUpload}
                id="file-upload"
              />
            </label>
          </div>
        </div>

        {file && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              <CheckCircle className="mr-1 h-4 w-4" />
              {file.name} selected
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              <AlertCircle className="mr-1 h-4 w-4" />
              {error}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              <Clock className="mr-1 h-4 w-4 animate-spin" />
              Processing health report...
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const HealthOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`card ${healthData.overallHealth === 'healthy' ? 'bg-green-50 border-green-200' : healthData.overallHealth === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center">
            {healthData.overallHealth === 'healthy' ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : healthData.overallHealth === 'warning' ? (
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            ) : (
              <X className="h-8 w-8 text-red-600" />
            )}
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-gray-800">Overall Health</h3>
              <p className={`text-sm ${healthData.overallHealth === 'healthy' ? 'text-green-600' : healthData.overallHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'}`}>
                {healthData.overallHealth === 'healthy' ? 'All systems operational' : 
                 healthData.overallHealth === 'warning' ? 'Some issues detected' : 'Critical issues found'}
              </p>
            </div>
          </div>
        </div>
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-blue-800">Active Nodes</h3>
              <p className="text-blue-600">{healthData.nodeCount || 'N/A'} nodes</p>
            </div>
          </div>
        </div>
        <div className="card bg-purple-50 border-purple-200">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-purple-800">Avg Latency</h3>
              <p className="text-purple-600">{healthData.latency || 'N/A'}ms</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Connections</span>
              <span className="font-medium">{healthData.activeConnections || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cache Hit Rate</span>
              <span className="font-medium">{healthData.cacheHitRate || 'N/A'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Issues</span>
              <span className="font-medium text-red-600">{healthData.issues}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Warnings</span>
              <span className="font-medium text-yellow-600">{healthData.warnings}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-gray-900">View Detailed Report</div>
              <div className="text-sm text-gray-500">See comprehensive health analysis</div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-gray-900">Export Report</div>
              <div className="text-sm text-gray-500">Download as PDF or JSON</div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-gray-900">View Logs</div>
              <div className="text-sm text-gray-500">Check detailed command outputs</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Aerospike Health Dashboard</h1>
        <p className="text-gray-600">Upload health report files to analyze cluster health and performance</p>
      </div>

      {!healthData ? (
        <div className="space-y-6">
          <UploadSection />
          <EmptyState />
        </div>
      ) : (
        <div className="space-y-6">
          <FileHeader />
          <HealthOverview />
        </div>
      )}
    </div>
  );
};

export default Dashboard; 