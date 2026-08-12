import React, { useState } from 'react';

const ROOM_TYPES = [
  'classroom', 'science_lab', 'stem_lab', 'art_room', 'music_room',
  'computer_lab', 'it_lab', 'library', 'gymnasium', 'sports_field',
  'basketball_court', 'tennis_court', 'swimming_pool', 'auditorium',
  'cafeteria', 'conference_room', 'meeting_room', 'staff_room',
  'counseling_office', 'principal_office', 'nurse_office',
  'workshop', 'robotics_lab', 'makerspace', 'testing_center', 'office', 'storeroom', 'other'
];

function RoomsWidget({ rooms, onImport, onAdd, onEdit, onWithdraw, onReinstate, onDelete }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    room_number: '', building: '', capacity: '', room_type: '', floor: '', status: 'available',
    features: {}, accessibility_flags: {}, equipment_list: [], notes: ''
  });
  const [otherTypeValue, setOtherTypeValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const filtered = (rooms || []).filter((r) => {
    const searchStr = `${r.room_number || ''} ${r.building || ''}`.toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.room_number || !formData.capacity || !formData.room_type) {
      setSubmitError('Room number, capacity, and room type are required');
      return;
    }
    if (formData.capacity < 1) {
      setSubmitError('Capacity must be at least 1');
      return;
    }
    let submitData = {...formData};
    if (formData.room_type === 'other' && otherTypeValue.trim()) {
      submitData.room_type = otherTypeValue.trim();
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = editingId ? await onEdit(editingId, submitData) : await onAdd(submitData);
    if (result.success) {
      setShowForm(false);
      setEditingId(null);
      setFormData({ room_number: '', building: '', capacity: '', room_type: '', floor: '', status: 'available', features: {}, accessibility_flags: {}, equipment_list: [], notes: '' });
      setOtherTypeValue('');
    } else {
      setSubmitError(result.error);
    }
    setSubmitting(false);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    const fd = new FormData();
    fd.append('csv_file', importFile);
    const result = await onImport(fd);
    setImportResult(result);
    if (result.success) { setShowImport(false); setImportFile(null); }
  };

  const handleEditClick = (r) => {
    setEditingId(r.id);
    setFormData({
      room_number: r.room_number || '', building: r.building || '', capacity: r.capacity || '', room_type: r.room_type || '', floor: r.floor || '', status: r.status || 'available',
      features: r.features ? (typeof r.features === 'string' ? JSON.parse(r.features) : r.features) : {},
      accessibility_flags: r.accessibility_flags ? (typeof r.accessibility_flags === 'string' ? JSON.parse(r.accessibility_flags) : r.accessibility_flags) : {},
      equipment_list: r.equipment_list ? (typeof r.equipment_list === 'string' ? JSON.parse(r.equipment_list) : r.equipment_list) : [],
      notes: r.notes || ''
    });
    if (!ROOM_TYPES.includes(r.room_type)) {
      setOtherTypeValue(r.room_type);
    }
    setShowForm(true);
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ room_number: '', building: '', capacity: '', room_type: '', floor: '', status: 'available', features: {}, accessibility_flags: {}, equipment_list: [], notes: '' });
    setOtherTypeValue('');
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setSubmitError(null); setOtherTypeValue(''); };
  const cancelImport = () => { setShowImport(false); setImportFile(null); setImportResult(null); };

  const selectedTypeIsOther = formData.room_type === 'other';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Room Manifest</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Import CSV</button>
          <button onClick={openAddForm} className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm">+ Add Room</button>
        </div>
      </div>

      {showImport && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Import Rooms (CSV)</h3>
          <form onSubmit={handleImportSubmit}>
            <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files[0])} className="mb-3 text-gray-400" />
            <p className="text-gray-500 text-xs mb-4">Required: room_number, capacity, room_type. Optional: building, floor, status, notes</p>
            <div className="flex gap-3">
              <button type="button" onClick={cancelImport} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Cancel</button>
              <button type="submit" className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm">Upload</button>
            </div>
          </form>
          {importResult && (
            <div className={`mt-4 px-4 py-2 rounded ${importResult.success ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'}`}>
              {importResult.success ? 'Import successful' : importResult.error}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">{editingId ? 'Edit Room' : 'New Room'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Essential Fields */}
            <div><label className="block text-gray-400 text-xs mb-1">Room Number *</label><input type="text" value={formData.room_number} onChange={(e) => setFormData({...formData, room_number: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Capacity *</label><input type="number" min="1" value={formData.capacity} onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || ''})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Room Type *</label><select value={formData.room_type} onChange={(e) => setFormData({...formData, room_type: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required><option value="">Select...</option>{ROOM_TYPES.map(type => <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}</select></div>
            
            {selectedTypeIsOther && (
              <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Specify Room Type *</label><input type="text" value={otherTypeValue} onChange={(e) => setOtherTypeValue(e.target.value)} placeholder="Enter custom room type..." className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            )}

            {/* Additional Fields */}
            <div><label className="block text-gray-400 text-xs mb-1">Building</label><input type="text" value={formData.building} onChange={(e) => setFormData({...formData, building: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Floor</label><input type="text" value={formData.floor} onChange={(e) => setFormData({...formData, floor: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Status</label><select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option><option value="blocked">Blocked</option></select></div>

            {/* Features & Equipment */}
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Features (JSON - {{"smart_board": true, "projector": true}})</label><input type="text" value={JSON.stringify(formData.features)} onChange={(e) => { try { setFormData({...formData, features: JSON.parse(e.target.value) || {}}); } catch {}}} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary font-mono text-xs" /></div>
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Equipment List (JSON - {"[\"whiteboard\",\"desk\"]"})</label><input type="text" value={JSON.stringify(formData.equipment_list)} onChange={(e) => { try { setFormData({...formData, equipment_list: JSON.parse(e.target.value) || []}); } catch {}}} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary font-mono text-xs" /></div>
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Accessibility Flags (JSON)</label><input type="text" value={JSON.stringify(formData.accessibility_flags)} onChange={(e) => { try { setFormData({...formData, accessibility_flags: JSON.parse(e.target.value) || {}}); } catch {}}} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary font-mono text-xs" /></div>

            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" rows="3" /></div>

            {submitError && <div className="md:col-span-3 bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">{submitError}</div>}
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={cancelForm} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm" disabled={submitting}>Cancel</button>
              <button type="submit" className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm" disabled={submitting}>{submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Room'}</button>
            </div>
          </form>
        </div>
      )}

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms..." className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white mb-4 focus:outline-none focus:border-timsys-primary" />
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800"><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Room #</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Building</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Type</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Capacity</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Status</th><th className="text-right px-4 py-3 text-gray-400 text-sm font-medium">Actions</th></tr></thead>
          <tbody>{filtered.map((r) => (<tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50"><td className="px-4 py-3 text-white text-sm">{r.room_number}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.building || '—'}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.room_type || 'general'}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.capacity}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.status || 'available'}</td><td className="px-4 py-3 text-right space-x-2"><button onClick={() => handleEditClick(r)} className="text-timsys-primary hover:text-white text-sm">Edit</button>{r.status === 'blocked' ? <><button onClick={() => onReinstate(r.id)} className="text-green-400 hover:text-green-300 text-sm">Reinstate</button><button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button></> : <button onClick={() => onWithdraw(r.id)} className="text-amber-400 hover:text-amber-300 text-sm">Withdraw</button>}</td></tr>))}{filtered.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No rooms found.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
export default RoomsWidget;
