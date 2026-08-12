import React, { useState } from 'react';

const SEX_OPTIONS = ['Male', 'Female'];
const ENROLLMENT_STATUS = ['active', 'withdrawn', 'graduated', 'suspended'];

function StudentsWidget({ students, onImport, onAdd, onEdit, onWithdraw, onReinstate, onDelete }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    // Required
    student_id: '', first_name: '', last_name: '', date_of_birth: '', sex: '',
    // Optional
    middle_name: '', preferred_name: '', nationality: '', ethnicity: '', primary_language: '', secondary_language: '',
    enrollment_date: '', enrollment_status: 'active', current_grade_level: '', homeroom: '', school_year: '',
    medical_alert_flag: 0, special_education_flag: 0, gifted_talented_flag: 0, esl_flag: 0, photo_url: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const filtered = (students || []).filter((r) => {
    const searchStr = `${r.student_id || ''} ${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.student_id || !formData.first_name || !formData.last_name || !formData.date_of_birth || !formData.sex) {
      setSubmitError('Student ID, first name, last name, date of birth, and sex are required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = editingId ? await onEdit(editingId, formData) : await onAdd(formData);
    if (result.success) {
      setShowForm(false);
      setEditingId(null);
      setFormData({
        student_id: '', first_name: '', last_name: '', date_of_birth: '', sex: '',
        middle_name: '', preferred_name: '', nationality: '', ethnicity: '', primary_language: '', secondary_language: '',
        enrollment_date: '', enrollment_status: 'active', current_grade_level: '', homeroom: '', school_year: '',
        medical_alert_flag: 0, special_education_flag: 0, gifted_talented_flag: 0, esl_flag: 0, photo_url: '', notes: ''
      });
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
      student_id: r.student_id || '', first_name: r.first_name || '', last_name: r.last_name || '', date_of_birth: r.date_of_birth || '', sex: r.sex || '',
      middle_name: r.middle_name || '', preferred_name: r.preferred_name || '', nationality: r.nationality || '', ethnicity: r.ethnicity || '',
      primary_language: r.primary_language || '', secondary_language: r.secondary_language || '',
      enrollment_date: r.enrollment_date || '', enrollment_status: r.enrollment_status || 'active', current_grade_level: r.current_grade_level || '',
      homeroom: r.homeroom || '', school_year: r.school_year || '',
      medical_alert_flag: r.medical_alert_flag || 0, special_education_flag: r.special_education_flag || 0, gifted_talented_flag: r.gifted_talented_flag || 0,
      esl_flag: r.esl_flag || 0, photo_url: r.photo_url || '', notes: r.notes || ''
    });
    setShowForm(true);
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      student_id: '', first_name: '', last_name: '', date_of_birth: '', sex: '',
      middle_name: '', preferred_name: '', nationality: '', ethnicity: '', primary_language: '', secondary_language: '',
      enrollment_date: '', enrollment_status: 'active', current_grade_level: '', homeroom: '', school_year: '',
      medical_alert_flag: 0, special_education_flag: 0, gifted_talented_flag: 0, esl_flag: 0, photo_url: '', notes: ''
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setSubmitError(null); };
  const cancelImport = () => { setShowImport(false); setImportFile(null); setImportResult(null); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Students</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Import CSV</button>
          <button onClick={openAddForm} className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm">+ Add Student</button>
        </div>
      </div>

      {showImport && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Import Students (CSV)</h3>
          <form onSubmit={handleImportSubmit}>
            <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files[0])} className="mb-3 text-gray-400" />
            <p className="text-gray-500 text-xs mb-4">Required: student_id, first_name, last_name, date_of_birth, sex. Optional: middle_name, nationality, ethnicity, primary_language, secondary_language, enrollment_date, enrollment_status, current_grade_level, homeroom, school_year, medical_alert_flag, special_education_flag, gifted_talented_flag, esl_flag, photo_url, notes</p>
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
          <h3 className="text-white font-semibold mb-4">{editingId ? 'Edit Student' : 'New Student'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Required Fields */}
            <div><label className="block text-gray-400 text-xs mb-1">Student ID *</label><input type="text" value={formData.student_id} onChange={(e) => setFormData({...formData, student_id: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">First Name *</label><input type="text" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Last Name *</label><input type="text" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Date of Birth *</label><input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Sex *</label><select value={formData.sex} onChange={(e) => setFormData({...formData, sex: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required><option value="">Select...</option>{SEX_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>

            {/* Optional Fields Row 1 */}
            <div><label className="block text-gray-400 text-xs mb-1">Middle Name</label><input type="text" value={formData.middle_name} onChange={(e) => setFormData({...formData, middle_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Preferred Name</label><input type="text" value={formData.preferred_name} onChange={(e) => setFormData({...formData, preferred_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Nationality</label><input type="text" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Ethnicity</label><input type="text" value={formData.ethnicity} onChange={(e) => setFormData({...formData, ethnicity: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Primary Language</label><input type="text" value={formData.primary_language} onChange={(e) => setFormData({...formData, primary_language: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Secondary Language</label><input type="text" value={formData.secondary_language} onChange={(e) => setFormData({...formData, secondary_language: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Enrollment Fields */}
            <div><label className="block text-gray-400 text-xs mb-1">Enrollment Date</label><input type="date" value={formData.enrollment_date} onChange={(e) => setFormData({...formData, enrollment_date: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Enrollment Status</label><select value={formData.enrollment_status} onChange={(e) => setFormData({...formData, enrollment_status: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"><option value="active">Active</option><option value="withdrawn">Withdrawn</option><option value="graduated">Graduated</option><option value="suspended">Suspended</option></select></div>
            <div><label className="block text-gray-400 text-xs mb-1">Grade Level</label><input type="text" value={formData.current_grade_level} onChange={(e) => setFormData({...formData, current_grade_level: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Homeroom</label><input type="text" value={formData.homeroom} onChange={(e) => setFormData({...formData, homeroom: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">School Year</label><input type="text" value={formData.school_year} onChange={(e) => setFormData({...formData, school_year: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Flags */}
            <div><label className="block text-gray-400 text-xs mb-1">Medical Alert</label><input type="checkbox" checked={formData.medical_alert_flag === 1} onChange={(e) => setFormData({...formData, medical_alert_flag: e.target.checked ? 1 : 0})} className="ml-2" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Special Education</label><input type="checkbox" checked={formData.special_education_flag === 1} onChange={(e) => setFormData({...formData, special_education_flag: e.target.checked ? 1 : 0})} className="ml-2" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Gifted & Talented</label><input type="checkbox" checked={formData.gifted_talented_flag === 1} onChange={(e) => setFormData({...formData, gifted_talented_flag: e.target.checked ? 1 : 0})} className="ml-2" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">ESL Student</label><input type="checkbox" checked={formData.esl_flag === 1} onChange={(e) => setFormData({...formData, esl_flag: e.target.checked ? 1 : 0})} className="ml-2" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Photo URL</label><input type="text" value={formData.photo_url} onChange={(e) => setFormData({...formData, photo_url: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Notes spans full width */}
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" rows="3" /></div>

            {submitError && <div className="md:col-span-3 bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">{submitError}</div>}
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={cancelForm} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm" disabled={submitting}>Cancel</button>
              <button type="submit" className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm" disabled={submitting}>{submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Student'}</button>
            </div>
          </form>
        </div>
      )}

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white mb-4 focus:outline-none focus:border-timsys-primary" />
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800"><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">ID</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Name</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">DOB</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Sex</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Status</th><th className="text-right px-4 py-3 text-gray-400 text-sm font-medium">Actions</th></tr></thead>
          <tbody>{filtered.map((r) => (<tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50"><td className="px-4 py-3 text-white text-sm">{r.student_id}</td><td className="px-4 py-3 text-white text-sm">{r.first_name} {r.last_name}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.date_of_birth}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.sex}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.enrollment_status}</td><td className="px-4 py-3 text-right space-x-2"><button onClick={() => handleEditClick(r)} className="text-timsys-primary hover:text-white text-sm">Edit</button>{r.enrollment_status === 'withdrawn' ? <><button onClick={() => onReinstate(r.id)} className="text-green-400 hover:text-green-300 text-sm">Reinstate</button><button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button></> : <button onClick={() => onWithdraw(r.id)} className="text-amber-400 hover:text-amber-300 text-sm">Withdraw</button>}</td></tr>))}{filtered.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No students found.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
export default StudentsWidget;
