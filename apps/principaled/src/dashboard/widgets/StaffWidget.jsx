import React, { useState } from 'react';

const SEX_OPTIONS = ['Male', 'Female'];
const EMPLOYMENT_STATUS = ['active', 'terminated', 'leave', 'contract'];
const EMPLOYMENT_TYPE = ['full_time', 'part_time', 'casual', 'contractor'];
const DBS_STATUS = ['pending', 'clear', 'disclosed', 'expired'];

function StaffWidget({ staff, onImport, onAdd, onEdit, onWithdraw, onReinstate, onDelete }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    // Required
    staff_id: '', first_name: '', last_name: '', hire_date: '', employment_type: 'full_time', job_title: '',
    // Optional
    middle_name: '', preferred_name: '', date_of_birth: '', sex: '', nationality: '', national_insurance_number: '',
    department: '', work_email: '', work_phone: '', phone_primary: '', phone_secondary: '', email_work: '', email_personal: '',
    dbs_check_status: 'pending', dbs_check_date: '', dbs_expiry_date: '', qualifications_summary: '', address_line1: '', address_line2: '', city: '', postal_code: '', country: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const filtered = (staff || []).filter((r) => {
    const searchStr = `${r.staff_id || ''} ${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.staff_id || !formData.first_name || !formData.last_name || !formData.hire_date || !formData.employment_type) {
      setSubmitError('Staff ID, first name, last name, hire date, and employment type are required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = editingId ? await onEdit(editingId, formData) : await onAdd(formData);
    if (result.success) {
      setShowForm(false);
      setEditingId(null);
      setFormData({
        staff_id: '', first_name: '', last_name: '', hire_date: '', employment_type: 'full_time', job_title: '',
        middle_name: '', preferred_name: '', date_of_birth: '', sex: '', nationality: '', national_insurance_number: '',
        department: '', work_email: '', work_phone: '', phone_primary: '', phone_secondary: '', email_work: '', email_personal: '',
        dbs_check_status: 'pending', dbs_check_date: '', dbs_expiry_date: '', qualifications_summary: '', address_line1: '', address_line2: '', city: '', postal_code: '', country: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '', notes: ''
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
      staff_id: r.staff_id || '', first_name: r.first_name || '', last_name: r.last_name || '', hire_date: r.hire_date || '', employment_type: r.employment_type || 'full_time', job_title: r.job_title || '',
      middle_name: r.middle_name || '', preferred_name: r.preferred_name || '', date_of_birth: r.date_of_birth || '', sex: r.sex || '', nationality: r.nationality || '', national_insurance_number: r.national_insurance_number || '',
      department: r.department || '', work_email: r.work_email || '', work_phone: r.work_phone || '', phone_primary: r.phone_primary || '', phone_secondary: r.phone_secondary || '', email_work: r.email_work || '', email_personal: r.email_personal || '',
      dbs_check_status: r.dbs_check_status || 'pending', dbs_check_date: r.dbs_check_date || '', dbs_expiry_date: r.dbs_expiry_date || '', qualifications_summary: r.qualifications_summary || '', address_line1: r.address_line1 || '', address_line2: r.address_line2 || '', city: r.city || '', postal_code: r.postal_code || '', country: r.country || '', emergency_contact_name: r.emergency_contact_name || '', emergency_contact_phone: r.emergency_contact_phone || '', emergency_contact_relationship: r.emergency_contact_relationship || '', notes: r.notes || ''
    });
    setShowForm(true);
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      staff_id: '', first_name: '', last_name: '', hire_date: '', employment_type: 'full_time', job_title: '',
      middle_name: '', preferred_name: '', date_of_birth: '', sex: '', nationality: '', national_insurance_number: '',
      department: '', work_email: '', work_phone: '', phone_primary: '', phone_secondary: '', email_work: '', email_personal: '',
      dbs_check_status: 'pending', dbs_check_date: '', dbs_expiry_date: '', qualifications_summary: '', address_line1: '', address_line2: '', city: '', postal_code: '', country: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '', notes: ''
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setSubmitError(null); };
  const cancelImport = () => { setShowImport(false); setImportFile(null); setImportResult(null); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Staff</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Import CSV</button>
          <button onClick={openAddForm} className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm">+ Add Staff</button>
        </div>
      </div>

      {showImport && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Import Staff (CSV)</h3>
          <form onSubmit={handleImportSubmit}>
            <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files[0])} className="mb-3 text-gray-400" />
            <p className="text-gray-500 text-xs mb-4">Required: staff_id, first_name, last_name, hire_date, employment_type. Optional: middle_name, date_of_birth, sex, nationality, national_insurance_number, department, job_title, work_email, work_phone, phone_primary, phone_secondary, email_work, email_personal, dbs_check_status, dbs_check_date, dbs_expiry_date, qualifications_summary, address_line1, address_line2, city, postal_code, country, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, notes</p>
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
          <h3 className="text-white font-semibold mb-4">{editingId ? 'Edit Staff' : 'New Staff'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Required Fields */}
            <div><label className="block text-gray-400 text-xs mb-1">Staff ID *</label><input type="text" value={formData.staff_id} onChange={(e) => setFormData({...formData, staff_id: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">First Name *</label><input type="text" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Last Name *</label><input type="text" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Hire Date *</label><input type="date" value={formData.hire_date} onChange={(e) => setFormData({...formData, hire_date: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Employment Type *</label><select value={formData.employment_type} onChange={(e) => setFormData({...formData, employment_type: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required><option value="">Select...</option>{EMPLOYMENT_TYPE.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            <div><label className="block text-gray-400 text-xs mb-1">Job Title *</label><input type="text" value={formData.job_title} onChange={(e) => setFormData({...formData, job_title: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" required /></div>

            {/* Personal Info */}
            <div><label className="block text-gray-400 text-xs mb-1">Middle Name</label><input type="text" value={formData.middle_name} onChange={(e) => setFormData({...formData, middle_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Preferred Name</label><input type="text" value={formData.preferred_name} onChange={(e) => setFormData({...formData, preferred_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Date of Birth</label><input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Sex</label><select value={formData.sex} onChange={(e) => setFormData({...formData, sex: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"><option value="">Select...</option>{SEX_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            <div><label className="block text-gray-400 text-xs mb-1">Nationality</label><input type="text" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">NI Number</label><input type="text" value={formData.national_insurance_number} onChange={(e) => setFormData({...formData, national_insurance_number: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Work Contact */}
            <div><label className="block text-gray-400 text-xs mb-1">Department</label><input type="text" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Work Email</label><input type="email" value={formData.work_email} onChange={(e) => setFormData({...formData, work_email: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Work Phone</label><input type="tel" value={formData.work_phone} onChange={(e) => setFormData({...formData, work_phone: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Primary Phone</label><input type="tel" value={formData.phone_primary} onChange={(e) => setFormData({...formData, phone_primary: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Secondary Phone</label><input type="tel" value={formData.phone_secondary} onChange={(e) => setFormData({...formData, phone_secondary: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Personal Email</label><input type="email" value={formData.email_personal} onChange={(e) => setFormData({...formData, email_personal: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* DBS */}
            <div><label className="block text-gray-400 text-xs mb-1">DBS Status</label><select value={formData.dbs_check_status} onChange={(e) => setFormData({...formData, dbs_check_status: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"><option value="pending">Pending</option><option value="clear">Clear</option><option value="disclosed">Disclosed</option><option value="expired">Expired</option></select></div>
            <div><label className="block text-gray-400 text-xs mb-1">DBS Check Date</label><input type="date" value={formData.dbs_check_date} onChange={(e) => setFormData({...formData, dbs_check_date: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">DBS Expiry</label><input type="date" value={formData.dbs_expiry_date} onChange={(e) => setFormData({...formData, dbs_expiry_date: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Qualifications */}
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Qualifications Summary</label><textarea value={formData.qualifications_summary} onChange={(e) => setFormData({...formData, qualifications_summary: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" rows="2" /></div>

            {/* Address */}
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Address Line 1</label><input type="text" value={formData.address_line1} onChange={(e) => setFormData({...formData, address_line1: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Address Line 2</label><input type="text" value={formData.address_line2} onChange={(e) => setFormData({...formData, address_line2: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Postal Code</label><input type="text" value={formData.postal_code} onChange={(e) => setFormData({...formData, postal_code: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Country</label><input type="text" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Emergency Contact */}
            <div><label className="block text-gray-400 text-xs mb-1">Emergency Contact Name</label><input type="text" value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Emergency Contact Phone</label><input type="tel" value={formData.emergency_contact_phone} onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>
            <div><label className="block text-gray-400 text-xs mb-1">Emergency Relationship</label><input type="text" value={formData.emergency_contact_relationship} onChange={(e) => setFormData({...formData, emergency_contact_relationship: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" /></div>

            {/* Notes */}
            <div className="md:col-span-3"><label className="block text-gray-400 text-xs mb-1">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary" rows="3" /></div>

            {submitError && <div className="md:col-span-3 bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">{submitError}</div>}
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={cancelForm} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm" disabled={submitting}>Cancel</button>
              <button type="submit" className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm" disabled={submitting}>{submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Staff'}</button>
            </div>
          </form>
        </div>
      )}

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white mb-4 focus:outline-none focus:border-timsys-primary" />
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800"><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">ID</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Name</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Position</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Type</th><th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Status</th><th className="text-right px-4 py-3 text-gray-400 text-sm font-medium">Actions</th></tr></thead>
          <tbody>{filtered.map((r) => (<tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50"><td className="px-4 py-3 text-white text-sm">{r.staff_id}</td><td className="px-4 py-3 text-white text-sm">{r.first_name} {r.last_name}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.job_title || '—'}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.employment_type || '—'}</td><td className="px-4 py-3 text-gray-400 text-sm">{r.employment_status || '—'}</td><td className="px-4 py-3 text-right space-x-2"><button onClick={() => handleEditClick(r)} className="text-timsys-primary hover:text-white text-sm">Edit</button>{r.employment_status === 'terminated' ? <><button onClick={() => onReinstate(r.id)} className="text-green-400 hover:text-green-300 text-sm">Reinstate</button><button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button></> : <button onClick={() => onWithdraw(r.id)} className="text-amber-400 hover:text-amber-300 text-sm">Withdraw</button>}</td></tr>))}{filtered.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No staff found.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
export default StaffWidget;
