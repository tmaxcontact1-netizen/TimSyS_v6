import React, { useState, useEffect } from 'react';
import * as api from "../api/client";
import OverviewWidget from './widgets/OverviewWidget';
import StudentsWidget from './widgets/StudentsWidget';
import StaffWidget from './widgets/StaffWidget';
import RoomsWidget from './widgets/RoomsWidget';
import InventoryWidget from './widgets/InventoryWidget';
import StudentProfileWidget from './widgets/StudentProfileWidget';
import StaffProfileWidget from './widgets/StaffProfileWidget';
import ModuleStatusWidget from './widgets/ModuleStatusWidget';
import IntelligenceWorkspace from './widgets/IntelligenceWorkspace';

// Module to UI mapping - operational modules show in sidebar
const MODULE_TO_VIEW = {
  // Existing operational modules (non-admin)
  'student_registry': { id: 'students', label: 'Students', widget: StudentsWidget, requiresAdmin: false },
  'staff_registry': { id: 'staff', label: 'Staff', widget: StaffWidget, requiresAdmin: false },
  'room_registry': { id: 'rooms', label: 'Rooms', widget: RoomsWidget, requiresAdmin: false },
  'inventory': { id: 'inventory', label: 'Inventory', widget: InventoryWidget, requiresAdmin: false },
  // Profile widgets (non-admin)
  'student_profile': { id: 'student_profiles', label: 'Student Profiles', widget: StudentProfileWidget, requiresAdmin: false },
  'staff_profile': { id: 'staff_profiles', label: 'Staff Profiles', widget: StaffProfileWidget, requiresAdmin: false },
  // Backend modules (admin/dev only - render as module status pages)
  'app_registry': { id: 'backend_app_registry', label: 'App Registry', widget: ModuleStatusWidget, moduleName: 'app_registry', requiresAdmin: true },
  'auto_rules': { id: 'backend_auto_rules', label: 'Auto Rules', widget: ModuleStatusWidget, moduleName: 'auto_rules', requiresAdmin: true },
  'builder': { id: 'backend_builder', label: 'Builder', widget: ModuleStatusWidget, moduleName: 'builder', requiresAdmin: true },
  'decision_log': { id: 'backend_decision_log', label: 'Decision Log', widget: ModuleStatusWidget, moduleName: 'decision_log', requiresAdmin: true },
  'event_store': { id: 'backend_event_store', label: 'Event Store', widget: ModuleStatusWidget, moduleName: 'event_store', requiresAdmin: true },
  'insight_management': { id: 'backend_insight_management', label: 'Insight Management', widget: ModuleStatusWidget, moduleName: 'insight_management', requiresAdmin: true },
  'intelligence': { id: 'backend_intelligence', label: 'Intelligence', widget: ModuleStatusWidget, moduleName: 'intelligence', requiresAdmin: true },
  'knowledge_store': { id: 'backend_knowledge_store', label: 'Knowledge Store', widget: ModuleStatusWidget, moduleName: 'knowledge_store', requiresAdmin: true },
  'notification': { id: 'backend_notification', label: 'Notification', widget: ModuleStatusWidget, moduleName: 'notification', requiresAdmin: true },
  'relationship_registry': { id: 'backend_relationship_registry', label: 'Relationship Registry', widget: ModuleStatusWidget, moduleName: 'relationship_registry', requiresAdmin: true },
  'snapshot_service': { id: 'backend_snapshot_service', label: 'Snapshot Service', widget: ModuleStatusWidget, moduleName: 'snapshot_service', requiresAdmin: true },
  'system_health': { id: 'backend_system_health', label: 'System Health', widget: ModuleStatusWidget, moduleName: 'system_health', requiresAdmin: true },
  'user_management': { id: 'backend_user_management', label: 'User Management', widget: ModuleStatusWidget, moduleName: 'user_management', requiresAdmin: true }
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
  const [enabledModules, setEnabledModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
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
      const response = await fetch('/modules/list-for-app?appId=principal-ed', {
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
    Promise.all([fetchData(), fetchEnabledModules(), fetchUserData()]).finally(() => setLoading(false));
  }, []);

  const hasAdminPermission = () => {
    if (!userData || !userData.permissions) return false;
    const perms = Array.isArray(userData.permissions) ? userData.permissions : [];
    return perms.includes('admin:*') || perms.some(p => p.startsWith('admin:'));
  };

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'intelligence_workspace', label: 'Insights' },
    ...Object.keys(MODULE_TO_VIEW)
      .filter(moduleName => {
        if (!enabledModules.includes(moduleName)) return false;
        if (MODULE_TO_VIEW[moduleName].requiresAdmin && !hasAdminPermission()) return false;
        return true;
      })
      .map(moduleName => ({
        id: MODULE_TO_VIEW[moduleName].id,
        label: MODULE_TO_VIEW[moduleName].label
      }))
  ];

  const renderWidget = () => {
    if (activeView === 'overview') {
      return <OverviewWidget data={data} />;
    }
    if (activeView === 'intelligence_workspace') return <IntelligenceWorkspace />;

    const moduleEntry = Object.entries(MODULE_TO_VIEW).find(([_, config]) => config.id === activeView);
    if (!moduleEntry) return <div className="text-gray-500">Unknown view</div>;

    const [moduleName, config] = moduleEntry;

    if (moduleName === 'student_registry') {
      return enabledModules.includes(moduleName) ? (
        <StudentsWidget
          students={data.students}
          onImport={handleImportStudents}
          onAdd={handleAddStudent}
          onEdit={handleEditStudent}
          onWithdraw={(id) => handleLifecycle(api.withdrawStudent, id)}
          onReinstate={(id) => handleLifecycle(api.reinstateStudent, id)}
          onDelete={handleDeleteStudent}
        />
      ) : null;
    }
    if (moduleName === 'staff_registry') {
      return enabledModules.includes(moduleName) ? (
        <StaffWidget
          staff={data.staff}
          onImport={handleImportStaff}
          onAdd={handleAddStaff}
          onEdit={handleEditStaff}
          onWithdraw={(id) => handleLifecycle(api.withdrawStaff, id)}
          onReinstate={(id) => handleLifecycle(api.reinstateStaff, id)}
          onDelete={handleDeleteStaff}
        />
      ) : null;
    }
    if (moduleName === 'room_registry') {
      return enabledModules.includes(moduleName) ? (
        <RoomsWidget
          rooms={data.rooms}
          onImport={handleImportRooms}
          onAdd={handleAddRoom}
          onEdit={handleEditRoom}
          onWithdraw={(id) => handleLifecycle(api.withdrawRoom, id)}
          onReinstate={(id) => handleLifecycle(api.reinstateRoom, id)}
          onDelete={handleDeleteRoom}
        />
      ) : null;
    }
    if (moduleName === 'inventory') {
      return enabledModules.includes(moduleName) ? (
        <InventoryWidget
          inventory={data.inventory}
          onImport={handleImportInventory}
          onAdd={handleAddInventory}
          onEdit={handleEditInventory}
          onWithdraw={(id) => handleLifecycle(api.withdrawItem, id)}
          onReinstate={(id) => handleLifecycle(api.reinstateItem, id)}
          onDelete={handleDeleteInventory}
        />
      ) : null;
    }
    if (moduleName === 'student_profile') {
      return <StudentProfileWidget />;
    }
    if (moduleName === 'staff_profile') {
      return <StaffProfileWidget />;
    }
    if (config.widget === ModuleStatusWidget && config.moduleName) {
      return <ModuleStatusWidget moduleName={config.moduleName} />;
    }

    return <div className="text-gray-500">Widget not found</div>;
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

  const handleLifecycle = async (action, id) => {
    try { await action(id); await fetchData(); return { success: true }; }
    catch (err) { return { success: false, error: err.response?.data?.error?.message || err.message }; }
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
    if (!confirm('Permanently delete this withdrawn student? This cannot be undone.')) return { success: true };
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
    if (!confirm('Permanently delete this withdrawn staff member? This cannot be undone.')) return { success: true };
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
    if (!confirm('Permanently delete this withdrawn room? This cannot be undone.')) return { success: true };
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
    if (!confirm('Permanently delete this withdrawn item? This cannot be undone.')) return { success: true };
    try {
      await api.deleteItem(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  };

  useEffect(() => {
    const availableViews = navItems.map(n => n.id);
    if (!availableViews.includes(activeView)) {
      setActiveView(availableViews[0] || 'overview');
    }
  }, [activeView, navItems]);

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
