import React from 'react';

function OverviewWidget({ data }) {
  const stats = data.stats || {};
  const studentCount = Array.isArray(data.students) ? data.students.length : (stats.student_count || 0);
  const staffCount = Array.isArray(data.staff) ? data.staff.length : (stats.staff_count || 0);
  const notifCount = Array.isArray(data.notifications) ? data.notifications.length : 0;

  const cards = [
    { label: 'Total Students', value: studentCount, color: 'text-blue-400' },
    { label: 'Total Staff', value: staffCount, color: 'text-green-400' },
    { label: 'Active Notifications', value: notifCount, color: 'text-yellow-400' },
    { label: 'System Status', value: 'Operational', color: 'text-green-400' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <p className="text-gray-400 text-sm mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">Recent Notifications</h3>
          <div className="space-y-3">
            {data.notifications?.slice(0, 5).map((n, i) => (
              <div key={n.id || i} className="text-sm border-b border-gray-800 pb-2">
                <p className="text-white">{n.title || n.message || 'Notification'}</p>
                <p className="text-gray-500 text-xs">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</p>
              </div>
            )) || <p className="text-gray-500 text-sm">No notifications</p>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full text-left bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
              Take Attendance
            </button>
            <button className="w-full text-left bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
              Add Student
            </button>
            <button className="w-full text-left bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
              Add Staff Member
            </button>
            <button className="w-full text-left bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
              Send Notification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewWidget;
