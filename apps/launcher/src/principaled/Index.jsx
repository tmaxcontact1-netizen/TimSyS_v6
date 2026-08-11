import React, { useState, useEffect, useCallback } from 'react';
import * as api from "./client";
import OverviewWidget from './widgets/OverviewWidget';
import StudentsWidget from './widgets/StudentsWidget';
import StaffWidget from './widgets/StaffWidget';
import RoomsWidget from './widgets/RoomsWidget';
import InventoryWidget from './widgets/InventoryWidget';
import StudentProfileWidget from './widgets/StudentProfileWidget';
import StaffProfileWidget from './widgets/StaffProfileWidget';
import AnalyticsWidget from './widgets/AnalyticsWidget';

const MODULE_TO_VIEW = {
  'student_registry': { id: 'students', label: 'Students', requiresAdmin: false },
  'staff_registry': { id: 'staff', label: 'Staff', requiresAdmin: false },
  'room_registry': { id: 'rooms', label: 'Rooms', requiresAdmin: false },
  'inventory': { id: 'inventory', label: 'Inventory', requiresAdmin: false },
  'analytics': { id: 'analytics', label: 'Analytics Dashboard', requiresAdmin: false },
  'student_profile': { id: 'student_profiles', label: 'Student Profiles', requiresAdmin: false },
  'staff_profile': { id: 'staff_profiles', label: 'Staff Profiles', requiresAdmin: false },
};

function PrincipalEdDashboard() {
  const [activeView, setActiveView] = useState('overview');
  const [userData, setUserData] = useState(null);
  const [data, setData] = useState({
    stats: null,
    students: [],
    staff: [],
    rooms: [],
    inventory: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshStudents = useCallback(async () => {
    try {
      const res = await api.listStudents();
      setData(prev => ({ ...prev, students: res.data?.students || [] }));
    } catch (err) { console.error('Failed to refresh students:', err); }
  }, []);

  const refreshStaff = useCallback(async () => {
    try {
      const res = await api.listStaff();
      setData(prev => ({ ...prev, staff: res.data?.staff || [] }));
    } catch (err) { console.error('Failed to refresh staff:', err); }
  }, []);

  const refreshRooms = useCallback(async () => {
    try {
      const res = await api.listRooms();
      setData(prev => ({ ...prev, rooms: res.data?.rooms || [] }));
    } catch (err) { console.error('Failed to refresh rooms:', err); }
  }, []);

  const refreshInventory = useCallback(async () => {
    try {
      const res = await api.listInventory();
      setData(prev => ({ ...prev, inventory: res.data?.inventory || [] }));
    } catch (err) { console.error('Failed to refresh inventory:', err); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.user) setUserData(json.user);
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };

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
          students: studentsRes.status === 'fulfilled' ? studentsRes.value.data?.students || [] : [],
          staff: staffRes.status === 'fulfilled' ? staffRes.value.data?.staff || [] : [],
          rooms: roomsRes.status === 'fulfilled' ? roomsRes.value.data?.rooms || [] : [],
          inventory: inventoryRes.status === 'fulfilled' ? inventoryRes.value.data?.inventory || [] : [],
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData().then(fetchUserData);
  }, []);

  const navItems = [
    { id: 'overview', label: 'Overview' },
    ...Object.keys(MODULE_TO_VIEW).map(moduleName => ({
      id: MODULE_TO_VIEW[moduleName].id,
      label: MODULE_TO_VIEW[moduleName].label
    }))
  ];

  // Student CRUD
  const handleAddStudent = async (formData) => {
    try {
      await api.createStudent(formData);
      await refreshStudents();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleEditStudent = async (id, formData) => {
    try {
      await api.updateStudent(id, formData);
      await refreshStudents();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleDeleteStudent = async (id) => {
    try {
      await api.deleteStudent(id);
      setData(prev => ({ ...prev, students: prev.students.filter(s => s.id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleWithdrawStudent = async (id) => {
    try {
      await api.withdrawStudent(id);
      await refreshStudents();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleReinstateStudent = async (id) => {
    try {
      await api.reinstateStudent(id);
      await refreshStudents();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleImportStudents = async (formData) => {
    try {
      await api.importStudents(formData);
      await refreshStudents();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  // Staff CRUD
  const handleAddStaff = async (formData) => {
    try {
      await api.createStaff(formData);
      await refreshStaff();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleEditStaff = async (id, formData) => {
    try {
      await api.updateStaff(id, formData);
      await refreshStaff();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleDeleteStaff = async (id) => {
    try {
      await api.deleteStaff(id);
      setData(prev => ({ ...prev, staff: prev.staff.filter(s => s.id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleWithdrawStaff = async (id) => {
    try {
      await api.withdrawStaff(id);
      await refreshStaff();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleReinstateStaff = async (id) => {
    try {
      await api.reinstateStaff(id);
      await refreshStaff();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleImportStaff = async (formData) => {
    try {
      await api.importStaff(formData);
      await refreshStaff();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  // Room CRUD
  const handleAddRoom = async (formData) => {
    try {
      await api.createRoom(formData);
      await refreshRooms();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleEditRoom = async (id, formData) => {
    try {
      await api.updateRoom(id, formData);
      await refreshRooms();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleDeleteRoom = async (id) => {
    try {
      await api.deleteRoom(id);
      setData(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleImportRooms = async (formData) => {
    try {
      await api.importRooms(formData);
      await refreshRooms();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  // Inventory CRUD
  const handleAddInventory = async (formData) => {
    try {
      await api.createItem(formData);
      await refreshInventory();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleEditInventory = async (id, formData) => {
    try {
      await api.updateItem(id, formData);
      await refreshInventory();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleDeleteInventory = async (id) => {
    try {
      await api.deleteItem(id);
      setData(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };
  const handleImportInventory = async (formData) => {
    try {
      await api.importInventory(formData);
      await refreshInventory();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  const renderWidget = () => {
    if (activeView === 'overview') {
      return <OverviewWidget data={data} />;
    }

    const moduleEntry = Object.entries(MODULE_TO_VIEW).find(([_, config]) => config.id === activeView);
    if (!moduleEntry) return <div className="text-gray-500">Unknown view</div>;

    const [moduleName] = moduleEntry;

    if (moduleName === 'student_registry') {
      return (
        <StudentsWidget
          students={data.students}
          onImport={handleImportStudents}
          onAdd={handleAddStudent}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onWithdraw={handleWithdrawStudent}
          onReinstate={handleReinstateStudent}
        />
      );
    }
    if (moduleName === 'staff_registry') {
      return (
        <StaffWidget
          staff={data.staff}
          onImport={handleImportStaff}
          onAdd={handleAddStaff}
          onEdit={handleEditStaff}
          onDelete={handleDeleteStaff}
          onWithdraw={handleWithdrawStaff}
          onReinstate={handleReinstateStaff}
        />
      );
    }
    if (moduleName === 'room_registry') {
      return (
        <RoomsWidget
          rooms={data.rooms}
          onImport={handleImportRooms}
          onAdd={handleAddRoom}
          onEdit={handleEditRoom}
          onDelete={handleDeleteRoom}
        />
      );
    }
    if (moduleName === 'inventory') {
      return (
        <InventoryWidget
          inventory={data.inventory}
          onImport={handleImportInventory}
          onAdd={handleAddInventory}
          onEdit={handleEditInventory}
          onDelete={handleDeleteInventory}
        />
      );
    }
    if (moduleName === 'analytics') {
      return <AnalyticsWidget />;
    }
    if (moduleName === 'student_profile') {
      return <StudentProfileWidget />;
    }
    if (moduleName === 'staff_profile') {
      return <StaffProfileWidget />;
    }

    return <div className="text-gray-500">Widget not found</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden">
      <aside className="w-56 shrink-0 overflow-y-auto bg-gray-900/50 border-r border-gray-800 p-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full text-left px-4 py-2 rounded text-sm transition-colors whitespace-nowrap ${
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

      <main className="flex-1 overflow-y-auto p-6">
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
