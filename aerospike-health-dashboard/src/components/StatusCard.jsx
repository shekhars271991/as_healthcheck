import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const StatusCard = ({ title, status, icon: Icon, description }) => {
  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      statusText: 'Healthy',
      statusClass: 'status-healthy'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      statusText: 'Warning',
      statusClass: 'status-warning'
    },
    critical: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      statusText: 'Critical',
      statusClass: 'status-critical'
    }
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={`card ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <span className={`status-indicator ${config.statusClass}`}>
          {config.statusText}
        </span>
      </div>
    </div>
  );
};

export default StatusCard; 