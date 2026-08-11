import React, { useState, useEffect } from 'react';

function AnalyticsWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch('/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
        {error}
      </div>
    );
  }

  const k = data.keyMetrics || {};
  const r = data.ratios || {};
  const a = data.alerts || {};
  const d = data.distributions || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
        <button onClick={fetchData} className="bg-timsys-primary text-white px-4 py-2 rounded text-sm">Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{k.students?.total || 0}</div>
          <div className="text-gray-400 text-sm mt-1">Total Students</div>
          <div className="text-green-400 text-xs mt-1">{k.students?.activePct || 0}% active</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{k.staff?.active || 0}</div>
          <div className="text-gray-400 text-sm mt-1">Active Staff</div>
          <div className="text-green-400 text-xs mt-1">{k.staff?.activePct || 0}% active</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{k.rooms?.available || 0}</div>
          <div className="text-gray-400 text-sm mt-1">Available Rooms</div>
          <div className="text-gray-400 text-xs mt-1">{k.rooms?.utilizationRate || '0%'} utilization</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{k.inventory?.total || 0}</div>
          <div className="text-gray-400 text-sm mt-1">Inventory Items</div>
          <div className="text-gray-400 text-xs mt-1">{k.inventory?.retentionRate || '0%'} retention</div>
        </div>
      </div>

      {/* Ratios */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Key Ratios</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(r).map(([key, val]) => (
            <div key={key} className="text-center bg-gray-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-timsys-primary">{val}</div>
              <div className="text-gray-400 text-xs mt-1">{key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Active Alerts</h3>
          <div className="space-y-2">
            {a.dbsExpired > 0 && (
              <div className="flex items-center gap-3 bg-red-900/30 rounded p-3">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">!</div>
                <div>
                  <div className="text-red-300 text-sm font-medium">{a.dbsExpired} Expired DBS</div>
                  <div className="text-gray-500 text-xs">Requires immediate attention</div>
                </div>
              </div>
            )}
            {a.dbsPending > 0 && (
              <div className="flex items-center gap-3 bg-yellow-900/30 rounded p-3">
                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs">!</div>
                <div>
                  <div className="text-yellow-300 text-sm font-medium">{a.dbsPending} Pending DBS</div>
                  <div className="text-gray-500 text-xs">Awaiting clearance</div>
                </div>
              </div>
            )}
            {a.roomsBlocked > 0 && (
              <div className="flex items-center gap-3 bg-purple-900/30 rounded p-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs">!</div>
                <div>
                  <div className="text-purple-300 text-sm font-medium">{a.roomsBlocked} Rooms Blocked</div>
                  <div className="text-gray-500 text-xs">Under maintenance</div>
                </div>
              </div>
            )}
            {a.dbsExpired === 0 && a.dbsPending === 0 && a.roomsBlocked === 0 && (
              <div className="text-gray-500 p-4">No active alerts</div>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Compliance Status</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-400 text-sm">Pending DBS</span>
                <span className="text-white text-sm font-bold">{a.dbsPending || 0}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded overflow-hidden">
                <div className="h-full bg-yellow-500 rounded" style={{ width: `${Math.min((a.dbsPending || 0) / 20 * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-400 text-sm">Expired DBS</span>
                <span className="text-white text-sm font-bold">{a.dbsExpired || 0}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded overflow-hidden">
                <div className="h-full bg-red-500 rounded" style={{ width: `${Math.min((a.dbsExpired || 0) / 20 * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Students by Grade</h3>
          <div className="flex items-end gap-2 h-40">
            {Object.entries(d.studentsByGrade || {}).map(([grade, count]) => {
              const max = Math.max(...Object.values(d.studentsByGrade || {}), 1);
              return (
                <div key={grade} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-400 mb-1">{count}</div>
                  <div className="w-full bg-timsys-primary rounded-t" style={{ height: `${(count / max) * 140}px` }} />
                  <div className="text-xs text-gray-500 mt-1">{grade}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Staff by Department</h3>
          <div className="flex items-end gap-2 h-40">
            {Object.entries(d.staffByDept || {}).map(([dept, count]) => {
              const max = Math.max(...Object.values(d.staffByDept || {}), 1);
              return (
                <div key={dept} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-400 mb-1">{count}</div>
                  <div className="w-full bg-green-500 rounded-t" style={{ height: `${(count / max) * 140}px` }} />
                  <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">{dept}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsWidget;
