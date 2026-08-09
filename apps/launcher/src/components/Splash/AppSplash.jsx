import React from 'react';

function AppSplash({ appName = 'TimSyS' }) {
  return (
    <div className="min-h-screen bg-timsys-dark flex flex-col items-center justify-center">
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-timsys-primary text-center">{appName}</h1>
      </div>
      <div className="spinner mb-6"></div>
      <p className="text-gray-400">Preparing your workspace...</p>
    </div>
  );
}

export default AppSplash;
