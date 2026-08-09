import React, { useState, useEffect } from 'react';
import * as api from '../api/client';
import OverviewWidget from './widgets/OverviewWidget';
import StudentsWidget from './widgets/StudentsWidget';
import StaffWidget from './widgets/StaffWidget';
import RoomsWidget from './widgets/RoomsWidget';
import InventoryWidget from './widgets/InventoryWidget';

// Module to UI mapping
const MODULE_TO_VIEW = {
  'student_registry': { id: 'students', label: 'Students', widget: StudentsWidget },
  'staff_registry': { id: 'staff', label: 'Staff', widget: StaffWidget },
  'room_registry': { id: 'rooms', label: 'Rooms', widget: RoomsWidget },
  'inventory': { id: 'inventory', label: 'Inventory', widget: InventoryWidget }
};

function PrincipalEdDashboard() {
  const [activeView, setActiveView] = useState('overview');
  const [data, setData] = useState({
    stats: null,
    students: [],
    staff: [],
    rooms: [],
    inventory: [],
  });
  const [enabledModules, setEnabledModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const [studentsRes, staffRes, roomsRes, inventoryRes] = await Promise.allSettled([
        api.listStudents(),
        api.listStaff(),
        api.listRooms(),
        api.listInventory(),
      ]);

      setData({
        stats: null,
        students: studentsRes.status === 'fulfilled' ? studentsRes.value.data.students || [] : [],
        staff: staffRes.status === 'fulfilled' ? staffRes.value.data.staff || [] : [],
        rooms: roomsRes.status === 'fulfilled' ? roomsRes.value.data.rooms || [] : [],
        inventory: inventoryRes.status === 'fulfilled' ? inventoryRes.value.data.inventory || [] : [],
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchEnabledModules = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch('/api/modules/list-for-app?appId=principaled', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const enabled = (data.data || []).filter(m => m.enabled).map(m => m.name);
      setEnabledModules(enabled);
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchData(), fetchEnabledModules()]).finally(() => setLoading(false));
  }, []);

  // Derive available views from enabled modules
  const availableViews = ['overview', ...Object.keys(MODULE_TO_VIEW).filter(m => enabledModules.includes(m)).map(v => MODULE_TO_VIEW[v].id)];

  // Build nav items
  const navItems = [
    { id: 'overview', label: 'Overview' },
    ...Object.keys(MODULE_TO_VIEW)
      .filter(moduleName => enabledModules.includes(moduleName))
      .map(moduleName => ({
        id: MODULE_TO_VIEW[moduleName].id,
        label: MODULE_TO_VIEW[moduleName].label
      }))
  ];

  // Render widget for current view
  const renderWidget = () => {
    switch (activeView) {
      case 'overview':
        return <OverviewWidget data={data} />;
      case 'students':
        return enabledModules.includes('student_registry') ? (
          <StudentsWidget
            students={data.students}
            onImport={handleImportStudents}
            onAdd={handleAddStudent}
            onEdit={handleEditStudent}
            onDelete={handleDeleteStudent}
          />
        ) : null;
      case 'staff':
        return enabledModules.includes('staff_registry') ? (
          <StaffWidget
            staff={data.staff}
            onImport={handleImportStaff}
            onAdd={handleAddStaff}
            onEdit={handleEditStaff}
            onDelete={handleDeleteStaff}
          />
        ) : null;
      case 'rooms':
        return enabledModules.includes('room_registry') ? (
          <RoomsWidget
            rooms={data.rooms}
            onImport={handleImportRooms}
            onAdd={handleAddRoom}
            onEdit={handleEditRoom}
            onDelete={handleDeleteRoom}
          />
        ) : null;
      case 'inventory':
        return enabledModules.includes('inventory') ? (
          <InventoryWidget
            inventory={data.inventory}
            onImport={handleImportInventory}
            onAdd={handleAddInventory}
            onEdit={handleEditInventory}
            onDelete={handleDeleteInventory}
          />
        ) : null;
      default:
        return <OverviewWidget data={data} />;
    }
  };

  const handleImportStudents = async (formData) => {
    try {
      await api.importStudents(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleAddStudent = async (formData) => {
    try {
      await api.createStudent(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleEditStudent = async (id, formData) => {
    try {
      await api.updateStudent(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Delete this student?')) return { success: true };
    try {
      await api.deleteStudent(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleImportStaff = async (formData) => {
    try {
      await api.importStaff(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleAddStaff = async (formData) => {
    try {
      await api.createStaff(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleEditStaff = async (id, formData) => {
    try {
      await api.updateStaff(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!confirm('Delete this staff member?')) return { success: true };
    try {
      await api.deleteStaff(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleImportRooms = async (formData) => {
    try {
      await api.importRooms(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleAddRoom = async (formData) => {
    try {
      await api.createRoom(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleEditRoom = async (id, formData) => {
    try {
      await api.updateRoom(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('Delete this room?')) return { success: true };
    try {
      await api.deleteRoom(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleImportInventory = async (formData) => {
    try {
      await api.importInventory(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleAddInventory = async (formData) => {
    try {
      await api.createItem(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleEditInventory = async (id, formData) => {
    try {
      await api.updateItem(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const handleDeleteInventory = async (id) => {
    if (!confirm('Delete this item?')) return { success: true };
    try {
      await api.deleteItem(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  // Reset active view if current one becomes unavailable
  useEffect(() => {
    if (!availableViews.includes(activeView)) {
      setActiveView(availableViews[0] || 'overview');
    }
  }, [availableViews, activeView]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="flex">
      <aside className="w-56 min-h-[calc(100vh-3.5rem)] bg-gray-900/50 border-r border-gray-800 p-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full text-left px-4 py-2 rounded text-sm transition-colors ${
                activeView === item.id
                  ? 'bg-timsys-primary text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {renderWidget()}
      </main>
    </div>
  );
}

export default PrincipalEdDashboard;
