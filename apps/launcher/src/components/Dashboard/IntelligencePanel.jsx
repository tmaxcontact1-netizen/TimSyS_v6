import React from 'react';
import { formatRelative } from '../../utils/formatDate';

function IntelligencePanel({ alerts = [], recommendations = [] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-timsys-accent mb-4">Intelligence Feed</h2>
      
      {alerts.length === 0 && recommendations.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No active alerts or recommendations</p>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-lg ${
              alert.severity === 'critical' 
                ? 'bg-red-900/30 border border-red-800' 
                : alert.severity === 'warning'
                ? 'bg-yellow-900/30 border border-yellow-800'
                : 'bg-blue-900/30 border border-blue-800'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-white">{alert.title}</h4>
                <span className="text-xs text-gray-500">{formatRelative(alert.createdAt)}</span>
              </div>
              <p className="text-gray-300 text-sm">{alert.message}</p>
            </div>
          ))}
          
          {recommendations.map((rec) => (
            <div key={rec.id} className="p-4 rounded-lg bg-purple-900/30 border border-purple-800">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-white">{rec.title}</h4>
                <span className="text-xs text-gray-500">{formatRelative(rec.createdAt)}</span>
              </div>
              <p className="text-gray-300 text-sm mb-3">{rec.description}</p>
              {rec.actions && rec.actions.length > 0 && (
                <div className="flex gap-2">
                  {rec.actions.map((action, idx) => (
                    <button
                      key={idx}
                      className="text-sm bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IntelligencePanel;