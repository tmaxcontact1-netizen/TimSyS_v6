import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getDashboard = async () => {
  const response = await client.get('/builder/dashboard');
  return response.data.dashboard || {};
};

export const getRecommendations = async () => {
  const response = await client.get('/builder/recommendations');
  return response.data.recommendations || {};
};

export const getModuleAnalysis = async (moduleName) => {
  const response = await client.get(`/builder/${moduleName}/analysis`);
  return response.data.analysis || {};
};

export const assembleModule = async (spec) => {
  const response = await client.post('/builder/assemble', spec);
  return response.data;
};

export const dryRunAssemble = async (spec) => {
  const response = await client.post('/builder/assemble', spec, {
    params: { dryRun: true }
  });
  return response.data;
};

export const getNewModuleTemplate = async (name) => {
  const response = await client.get('/builder/new-module', {
    params: { name }
  });
  return response.data;
};

export const getModulesForApp = async (appId) => {
  const response = await client.get('/modules/list-for-app', { params: { appId } });
  return response.data.data || [];
};

export const setModuleForApp = async (appId, moduleName, enabled) => {
  const response = enabled
    ? await client.post('/modules/assign', { appId, moduleName })
    : await client.delete('/modules/unassign', { params: { appId, moduleName } });
  return response.data;
};

export const getComponentsForApp = async (appId) => {
  const response = await client.get('/components/list-for-app', { params: { appId } });
  return response.data.data || [];
};

export const setComponentForApp = async (appId, componentName, enabled) => {
  const response = enabled
    ? await client.post('/components/assign', { appId, componentName })
    : await client.delete('/components/unassign', { params: { appId, componentName } });
  return response.data;
};

export const getDraftModules = async () => {
  const response = await client.get('/builder/drafts');
  return response.data.data || [];
};

// Preset configurations for non-technical users
export const getPresetTemplates = () => {
  return [
    {
      id: 'attendance_tracker',
      name: 'Attendance Tracker',
      description: 'Track daily attendance for students and staff',
      components: ['student_profile.read', 'student_registry.read', 'student_profile.write']
    },
    {
      id: 'gradebook',
      name: 'Gradebook',
      description: 'Record and manage student grades and assignments',
      components: ['student_registry.read', 'student_profile.read', 'auto_rules.write', 'notification.write']
    },
    {
      id: 'discipline_log',
      name: 'Discipline & Behavior Log',
      description: 'Track incidents and behavioral interventions',
      components: ['student_registry.read', 'staff_profile.read', 'notification.write', 'auto_rules.write']
    },
    {
      id: 'staff_directory',
      name: 'Staff Directory',
      description: 'Manage staff profiles, contact info, and certifications',
      components: ['staff_profile.read', 'staff_registry.read', 'staff_profile.write']
    },
    {
      id: 'room_scheduler',
      name: 'Room Scheduler',
      description: 'Book and manage rooms and facilities',
      components: ['room_registry.read', 'room_registry.write', 'staff_profile.read']
    },
    {
      id: 'parent_portal',
      name: 'Parent Portal',
      description: 'Allow parents to view student progress and communicate',
      components: ['student_registry.read', 'notification.read', 'relationship.read']
    },
    {
      id: 'inventory_manager',
      name: 'Inventory Manager',
      description: 'Track supplies, equipment, and materials',
      components: ['inventory.read', 'inventory.write', 'staff_profile.read']
    },
    {
      id: 'custom_form',
      name: 'Custom Form Builder',
      description: 'Create custom data collection forms',
      components: ['builder.scaffold', 'auto_rules.write', 'notification.write']
    }
  ];
};

export const getUserComponents = () => {
  // What a non-tech admin actually needs to see
  return [
    { name: 'Student Data', key: 'student_data', category: 'Students' },
    { name: 'Staff Data', key: 'staff_data', category: 'Staff' },
    { name: 'Rooms & Facilities', key: 'rooms', category: 'Facilities' },
    { name: 'Notifications', key: 'notifications', category: 'Communication' },
    { name: 'Reports & Analytics', key: 'reports', category: 'Analytics' },
    { name: 'Parent Connections', key: 'parents', category: 'Communication' },
    { name: 'Inventory Tracking', key: 'inventory', category: 'Operations' },
    { name: 'Behavior Monitoring', key: 'behavior', category: 'Student Services' }
  ];
};
