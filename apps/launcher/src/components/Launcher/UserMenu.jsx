import React, { useState } from 'react';

function UserMenu({ user, onLogout }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-3 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 bg-timsys-primary rounded-full flex items-center justify-center">
          <span className="text-white font-semibold">
            {user?.displayName?.charAt(0) || 'U'}
          </span>
        </div>
        <span className="text-white">{user?.displayName || 'User'}</span>
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
          <div className="py-2">
            <button
              onClick={onLogout}
              className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;