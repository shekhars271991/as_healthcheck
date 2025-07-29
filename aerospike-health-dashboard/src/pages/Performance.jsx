import React from 'react';
import { Gauge } from 'lucide-react';

const Performance = () => {
  const EmptyState = () => (
    <div className="text-center py-12">
      <Gauge className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">No performance data available</h3>
      <p className="mt-1 text-sm text-gray-500">
        Upload a collectinfo file from the dashboard to view performance metrics.
      </p>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Performance Metrics</h1>
        <p className="text-gray-600">Latency, throughput, and cache performance analysis</p>
      </div>
      
      <EmptyState />
    </div>
  );
};

export default Performance; 