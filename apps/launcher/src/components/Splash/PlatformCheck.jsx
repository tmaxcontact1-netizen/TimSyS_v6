import React from 'react';

function PlatformCheck({ status, error, onRetry }) {
  return (
    <div className="min-h-screen bg-timsys-dark flex flex-col items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-timsys-primary mb-6 text-center">TimSyS</h1>

        {status === 'checking' && (
          <>
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-300 text-center">Connecting to platform...</p>
          </>
        )}

        {status === 'online' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-400">Platform ready</p>
          </div>
        )}

        {status === 'offline' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 mb-2">Cannot connect to platform</p>
            <p className="text-gray-400 text-sm mb-6">
              {error || 'Unknown error'}<br />
              Ensure the platform is running on localhost:3000
            </p>
            <button
              onClick={onRetry}
              className="bg-timsys-primary hover:bg-timsys-secondary text-white px-6 py-2 rounded-lg"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlatformCheck;
