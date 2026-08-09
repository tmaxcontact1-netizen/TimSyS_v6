import React from 'react';

function MainLayout({ sidebar, header, children, intelligencePanel }) {
  return (
    <div className="flex h-screen bg-timsys-dark">
      {sidebar && (
        <aside className="w-64 bg-gray-900 border-r border-gray-800">
          {sidebar}
        </aside>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {header && (
          <header className="bg-gray-900/50 border-b border-gray-800">
            {header}
          </header>
        )}
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        
        {intelligencePanel && (
          <aside className="w-96 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
            {intelligencePanel}
          </aside>
        )}
      </div>
    </div>
  );
}

export default MainLayout;