import React from 'react';

function NotificationsWidget({ notifications }) {
  const notifs = notifications || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Notifications</h2>
        <button className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm">
          + Send Notification
        </button>
      </div>

      <div className="space-y-3">
        {notifs.map((n, i) => (
          <div key={n.id || i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-white font-medium">{n.title || n.type || 'Notification'}</h3>
              <span className="text-gray-500 text-xs">
                {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
              </span>
            </div>
            <p className="text-gray-400 text-sm">{n.message || n.body || ''}</p>
            {n.severity && (
              <span className={`inline-flex mt-2 px-2 py-0.5 rounded text-xs ${
                n.severity === 'critical' ? 'bg-red-900/50 text-red-400' :
                n.severity === 'warning' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-blue-900/50 text-blue-400'
              }`}>
                {n.severity}
              </span>
            )}
          </div>
        ))}
        {notifs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No notifications.
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationsWidget;
