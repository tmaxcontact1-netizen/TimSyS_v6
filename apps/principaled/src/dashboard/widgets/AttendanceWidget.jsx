import React from 'react';

function AttendanceWidget() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dummyData = days.map((day, i) => ({
    day,
    present: 180 + Math.floor(Math.random() * 20),
    absent: 10 + Math.floor(Math.random() * 15),
    late: 3 + Math.floor(Math.random() * 7),
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Attendance</h2>
        <button className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm">
          Take Attendance
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-white font-semibold mb-4">This Week</h3>
        <div className="grid grid-cols-5 gap-4">
          {dummyData.map((d) => (
            <div key={d.day} className="text-center">
              <p className="text-gray-400 text-sm mb-2">{d.day}</p>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-green-400 text-2xl font-bold">{d.present}</p>
                <p className="text-gray-500 text-xs">Present</p>
                <div className="mt-2 text-xs space-y-1">
                  <p className="text-red-400">{d.absent} absent</p>
                  <p className="text-yellow-400">{d.late} late</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-white font-semibold mb-4">Rate Trend</h3>
        <div className="flex items-end gap-2 h-32">
          {dummyData.map((d) => {
            const rate = Math.round((d.present / (d.present + d.absent + d.late)) * 100);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-timsys-primary rounded-t"
                  style={{ height: `${rate}%` }}
                ></div>
                <p className="text-gray-500 text-xs mt-1">{d.day}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AttendanceWidget;
