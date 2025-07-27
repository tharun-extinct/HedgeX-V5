import React from 'react';
import { PerformanceDashboard } from '../components/system/PerformanceDashboard';

const SystemStatusPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <PerformanceDashboard />
    </div>
  );
};

export default SystemStatusPage;