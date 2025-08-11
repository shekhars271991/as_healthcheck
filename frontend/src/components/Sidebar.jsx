import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  Gauge, 
  Settings, 
  Server, 
  GitBranch, 
  FileText,
  Database,
  History,
  Plus
} from 'lucide-react';

const Sidebar = () => {
  const navigation = [
    { name: 'Health Checks', href: '/health-checks', icon: History },
    { name: 'Create Health Check', href: '/health-check/create', icon: Plus },
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Cluster Health', href: '/cluster-health', icon: Activity },
    { name: 'Performance', href: '/performance', icon: Gauge },
    { name: 'Configuration', href: '/configuration', icon: Settings },
    { name: 'System Info', href: '/system-info', icon: Server },
    { name: 'XDR Status', href: '/xdr-status', icon: GitBranch },
    { name: 'Logs', href: '/logs', icon: FileText },
  ];

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200">
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <Database className="h-8 w-8 text-primary-600" />
        <div className="ml-3">
          <h1 className="text-lg font-semibold text-gray-900">Aerospike Health</h1>
          <p className="text-sm text-gray-500">Dashboard</p>
        </div>
      </div>
      
      <nav className="mt-6 px-3">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                }
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </nav>
      
      <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p>Generated: {new Date().toLocaleDateString()}</p>
          <p>Version: 1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 