import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function Tile({ tile }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderContent = () => {
    switch (tile.type) {
      case 'stats':
        return <p className="text-gray-400">Statistics widget — coming soon</p>;
      case 'activity':
        return <p className="text-gray-400">Recent activity — coming soon</p>;
      case 'tasks':
        return <p className="text-gray-400">Pending tasks — coming soon</p>;
      case 'health':
        return <p className="text-gray-400">System health — coming soon</p>;
      default:
        return <p className="text-gray-400">{tile.type}</p>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-grab active:cursor-grabbing hover:border-gray-700"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-white">{tile.title}</h3>
        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 11-4 0 2 2 0 014 0zM7 8a2 2 0 11-4 0 2 2 0 014 0zM7 14a2 2 0 11-4 0 2 2 0 014 0zM17 2a2 2 0 11-4 0 2 2 0 014 0zM17 8a2 2 0 11-4 0 2 2 0 014 0zM17 14a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <div>{renderContent()}</div>
    </div>
  );
}

export default Tile;
