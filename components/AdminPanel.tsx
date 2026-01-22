import React, { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { User, ActivityLog } from '../types';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  useEffect(() => {
    // Load data from authService
    setUsers(authService.getAllUsers());
    setActivityLog(authService.getLogs());

    // Optional: Poll for updates if desired, or just load on mount
  }, []);

  // Calculate stats
  const totalUsers = users.length;
  const activeSubs = users.filter(u => u.status === 'Active').length;
  // Simple mock revenue calculation
  const totalRevenue = users.reduce((acc, user) => {
    const val = parseFloat(user.paidAmount.replace('$', ''));
    return acc + val;
  }, 0).toFixed(2);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Platform Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-600 font-semibold uppercase">Total Users</div>
            <div className="text-3xl font-bold text-slate-900">{totalUsers}</div>
          </div>
           <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <div className="text-sm text-green-600 font-semibold uppercase">Revenue (Total)</div>
            <div className="text-3xl font-bold text-slate-900">${totalRevenue}</div>
          </div>
           <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="text-sm text-purple-600 font-semibold uppercase">Activities Logged</div>
            <div className="text-3xl font-bold text-slate-900">{activityLog.length}</div>
          </div>
           <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <div className="text-sm text-orange-600 font-semibold uppercase">Active Accounts</div>
            <div className="text-3xl font-bold text-slate-900">{activeSubs}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">User Directory</h3>
            <div className="overflow-hidden border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{u.plan}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
             <h3 className="text-lg font-bold text-slate-800 mb-4">Audit Log</h3>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 h-[400px] overflow-y-auto">
                <ul className="space-y-3">
                  {activityLog.map(log => (
                    <li key={log.id} className="text-sm border-b border-slate-200 pb-2 last:border-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1 rounded">{log.action}</span>
                        <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-700">{log.userName}</span>
                        {log.details && <span className="text-xs text-slate-500 truncate max-w-[150px]">{log.details}</span>}
                      </div>
                    </li>
                  ))}
                  {activityLog.length === 0 && <li className="text-slate-500 italic text-sm">No activity recorded yet.</li>}
                </ul>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
