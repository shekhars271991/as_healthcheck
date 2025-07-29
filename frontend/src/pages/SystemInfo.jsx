import React from 'react';
import { Server } from 'lucide-react';

const SystemInfo = () => {
  const EmptyState = () => (
    <div className="text-center py-12">
      <Server className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No system information available</h3>
      <p className="mt-1 text-sm text-gray-500">
        Upload a collectinfo file from the dashboard to view system details.
      </p>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">System Information</h1>
        <p className="text-gray-600">Namespaces, sets, indexes, and system details</p>
      </div>
      
      <EmptyState />
    </div>
  );
};

export default SystemInfo; 