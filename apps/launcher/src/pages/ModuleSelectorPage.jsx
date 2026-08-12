import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assembleModule, getPresetTemplates, getUserComponents, getModulesForApp, setModuleForApp } from '../api/builder';
import useAuthStore from '../store/authStore';
import { useAnyPermission } from '../utils/permissions';

const TARGET_APP = 'principal-ed';

function ModuleSelectorPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canBuild = useAnyPermission(['admin:*', 'admin:builder:access']);
  
  const [installedModules, setInstalledModules] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState(null);
  const [moduleDetails, setModuleDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const presets = getPresetTemplates();
  const features = getUserComponents();

  // Fetch the canonical module catalogue and Principal'Ed assignments.
  const fetchModules = async () => {
    try {
      const modules = await getModulesForApp(TARGET_APP);
      setInstalledModules(Array.isArray(modules) ? modules : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canBuild) {
      navigate('/', { replace: true });
      return;
    }
    fetchModules();
  }, [canBuild]);

  const handleCreateApp = async (preset) => {
    if (!preset.name) {
      alert('Please enter an app name');
      return;
    }

    setCreating(true);
    try {
      const spec = {
        name: preset.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        displayName: preset.displayName,
        description: preset.description,
        version: '1.0.0',
        components: preset.components || [],
        dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events']
      };

      const result = await assembleModule(spec);
      
      if (result.success) {
        alert(`"${preset.displayName}" was created as a draft. Implement and validate its handlers before activation.`);
        setShowCreateModal(false);
        resetForm();
        fetchModules();
      } else {
        alert(`Failed: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleModule = async (moduleName, enabled) => {
    try {
      await setModuleForApp(TARGET_APP, moduleName, !enabled);
      await fetchModules();
    } catch (err) {
      alert(`Failed: ${err.response?.data?.error?.message || err.message}`);
    }
  };

  const handleDeleteModule = async (moduleName) => {
    if (!confirm(`Remove "${moduleName}" from Principal'Ed? The module and its data will remain intact.`)) return;
    
    try {
      await setModuleForApp(TARGET_APP, moduleName, false);
      await fetchModules();
    } catch (err) {
      alert(`Failed: ${err.response?.data?.error?.message || err.message}`);
    }
  };

  const handleViewDetails = async (app) => {
    setSelectedForDetails(app.name);
    setModuleDetails({
      name: app.name,
      displayName: app.name.replaceAll('_', ' '),
      description: `Version ${app.version || 'unknown'} · ${app.status || 'registered'}`,
      components: app.capabilitiesProvided || app.provides || [],
      roles: app.capabilitiesRequired || app.requires || []
    });
  };

  const closeDetails = () => {
    setSelectedForDetails(null);
    setModuleDetails(null);
  };

  const resetForm = () => {
    setPresetForm({
      name: '',
      displayName: '',
      description: '',
      components: [],
      selectedFeatures: []
    });
  };

  const [presetForm, setPresetForm] = useState({
    name: '',
    displayName: '',
    description: '',
    components: []
  });

  const selectedPresetTemplate = presets.find(p => p.id === presetForm.templateId);

  if (!loading && !canBuild) {
    return null;
  }

  const featureMap = {
    'student_data': ['student_registry.read', 'student_profile.read', 'student_registry.write'],
    'staff_data': ['staff_registry.read', 'staff_profile.read', 'staff_registry.write'],
    'rooms': ['room_registry.read', 'room_registry.write'],
    'notifications': ['notification.read', 'notification.write'],
    'reports': ['auto_rules.read', 'intelligence.read'],
    'parents': ['relationship.read', 'notification.write'],
    'inventory': ['inventory.read', 'inventory.write'],
    'behavior': ['auto_rules.write', 'notification.write', 'decision_log.write']
  };

  const updateSelectedFeatures = (featureKey) => {
    const newComponents = featureMap[featureKey] || [];
    setPresetForm(prev => ({
      ...prev,
      templateId: null,
      displayName: '',
      description: '',
      selectedFeatures: (prev.selectedFeatures || []).includes(featureKey)
        ? prev.selectedFeatures.filter(f => f !== featureKey)
        : [...(prev.selectedFeatures || []), featureKey]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-timsys-dark">
      {/* Header */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">← Back</button>
            <h1 className="text-2xl font-bold text-timsys-primary">Module Selector</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Available Modules: <span className="text-white">{installedModules.length}</span></span>
            <button
              onClick={() => {
                setShowCreateModal(true);
                resetForm();
              }}
              className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded"
            >
              + Create New App
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Installed Modules Grid */}
        <h2 className="text-xl font-bold text-white mb-4">Principal'Ed Modules</h2>
        
        {installedModules.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No apps installed yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-timsys-primary hover:bg-timsys-secondary text-white px-6 py-2 rounded"
            >
              Create Your First App
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {installedModules.map((app) => (
              <div key={app.name} className="bg-gray-900 border border-gray-800 rounded-lg p-5 relative">
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${app.enabled ? 'bg-green-500' : 'bg-gray-600'}`} title={app.enabled ? 'Included' : 'Not included'} />
                
                <h3 className="text-white font-bold text-lg mb-1">{app.name.replaceAll('_', ' ')}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">Version {app.version || 'unknown'}</p>
                
                {/* Component Map Preview */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {(app.capabilitiesProvided || app.provides || []).slice(0, 3).map((f, i) => (
                      <span key={i} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">{f.split('.').pop()}</span>
                    ))}
                    {(app.capabilitiesProvided || app.provides || []).length > 3 && (
                      <span className="text-gray-500 text-xs">+{(app.capabilitiesProvided || app.provides || []).length - 3} more</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetails(app)}
                    className="text-timsys-primary hover:text-white text-sm flex-1"
                  >
                    View Components
                  </button>
                  <button
                    onClick={() => handleToggleModule(app.name, app.enabled)}
                    className={`text-sm flex-1 ${app.enabled ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
                  >
                    {app.enabled ? 'Remove' : 'Add'}
                  </button>
                  <button
                    onClick={() => handleDeleteModule(app.name)}
                    className="text-red-400 hover:text-red-300 text-sm"
                    title="Remove from dashboard"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Templates Section */}
        <h2 className="text-xl font-bold text-white mb-4">Quick Create Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presets.slice(0, 4).map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setPresetForm({
                  templateId: preset.id,
                  displayName: preset.name,
                  description: preset.description,
                  components: preset.components,
                  selectedFeatures: []
                });
              }}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-left hover:border-timsys-primary transition-colors"
            >
              <p className="text-white font-medium">{preset.name}</p>
              <p className="text-gray-400 text-xs mt-1">{preset.description}</p>
            </button>
          ))}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Create a New App</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Choose template */}
              <div>
                <label className="block text-gray-400 text-sm mb-3">Choose a starting template:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setPresetForm({
                        templateId: preset.id,
                        displayName: preset.name,
                        description: preset.description,
                        components: preset.components,
                        selectedFeatures: []
                      })}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        presetForm.templateId === preset.id
                          ? 'bg-timsys-primary/20 border-timsys-primary'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <p className="text-white font-medium">{preset.name}</p>
                      <p className="text-gray-400 text-xs mt-1">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Add features */}
              <div>
                <label className="block text-gray-400 text-sm mb-3">Add extra features:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {features.map((feature) => (
                    <label key={feature.key} className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      presetForm.selectedFeatures?.includes(feature.key)
                        ? 'bg-timsys-primary/20 border-timsys-primary'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}>
                      <input
                        type="checkbox"
                        checked={presetForm.selectedFeatures?.includes(feature.key) || false}
                        onChange={() => updateSelectedFeatures(feature.key)}
                        className="sr-only"
                      />
                      <p className="text-white font-medium text-sm">{feature.name}</p>
                      <p className="text-gray-400 text-xs">{feature.category}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 3: Name */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">App Display Name</label>
                <input
                  type="text"
                  value={presetForm.displayName}
                  onChange={(e) => setPresetForm({ ...presetForm, displayName: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-timsys-primary"
                  placeholder="My Custom App"
                />
                <p className="text-gray-500 text-xs mt-1">This is what staff will see on the app selector screen.</p>
              </div>

              {/* Component Map Summary */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Component Map (Under the Hood)</h3>
                <div className="flex flex-wrap gap-2">
                  {[...(selectedPresetTemplate?.components || []), ...(presetForm.selectedFeatures || []).flatMap(f => featureMap[f])].filter(Boolean).map((c, i) => (
                    <span key={i} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded font-mono">{c}</span>
                  ))}
                  {(selectedPresetTemplate?.components || []).length === 0 && (presetForm.selectedFeatures || []).length === 0 && (
                    <span className="text-gray-500 text-sm">No components selected yet.</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-3">These are the capabilities this app will have. Staff can only do what's listed here.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateApp(presetForm)}
                  disabled={creating || !presetForm.displayName.trim()}
                  className="bg-timsys-primary hover:bg-timsys-secondary text-white px-6 py-2 rounded disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create App'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module Details Modal */}
      {selectedForDetails && moduleDetails && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white">{moduleDetails.displayName}</h2>
                  <p className="text-gray-400 text-sm mt-1">{moduleDetails.description}</p>
                </div>
                <button onClick={closeDetails} className="text-gray-400 hover:text-white text-2xl">×</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-3">Feature List</h3>
                {moduleDetails.components.length === 0 ? (
                  <p className="text-gray-500 text-sm">No features configured.</p>
                ) : (
                  <ul className="space-y-2">
                    {moduleDetails.components.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-timsys-primary rounded-full"></span>
                        <span className="text-gray-300 text-sm">{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">User Roles Allowed</h3>
                {moduleDetails.roles.length === 0 ? (
                  <p className="text-gray-500 text-sm">No role restrictions.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {moduleDetails.roles.map((r, i) => (
                      <span key={i} className="bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded">{r}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Component Map (Internal)</h3>
                <div className="font-mono text-xs text-gray-400 bg-gray-900 p-3 rounded overflow-x-auto">
                  {JSON.stringify(moduleDetails.components, null, 2)}
                </div>
                <p className="text-gray-500 text-xs mt-2">This defines every capability the app has access to in the system.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={() => {
                    handleDeleteModule(moduleDetails.name);
                    closeDetails();
                  }}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove App
                </button>
                <button
                  onClick={closeDetails}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModuleSelectorPage;
