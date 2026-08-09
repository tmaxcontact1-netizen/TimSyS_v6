import React, { useState, useEffect } from 'react';
import * as api from '../../api/client';

function StaffProfileWidget() {
  const [staff, setStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await api.listStaff();
      setStaff(response.data?.staff || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // Split departments (comma or semicolon separated) for filtering
  const allDepartments = [...new Set(
    staff.flatMap(s => 
      (s.department || '').split(/[,;]/).map(d => d.trim()).filter(Boolean)
    )
  )].sort();

  const filteredStaff = staff.filter(s => {
    const nameMatch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const depts = (s.department || '').split(/[,;]/).map(d => d.trim());
    const deptMatch = !deptFilter || depts.includes(deptFilter);
    return nameMatch && deptMatch;
  });

  const viewProfile = async (staffMember) => {
    setSelectedStaff(staffMember);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/staff/${staffMember.id}/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setProfileData(data.profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInsight = async (staffId) => {
    try {
      const response = await fetch(`/staff/${staffId}/profile/insights/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      alert('Deep insight generated!');
      await viewProfile(selectedStaff);
    } catch (err) {
      alert('Failed to generate insight: ' + err.message);
    }
  };

  const clearSelection = () => {
    setSelectedStaff(null);
    setProfileData(null);
  };

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
        {error}
      </div>
    );
  }

  // Profile detail view
  if (selectedStaff && profileData) {
    const { staff: s, extended, certifications, metadata, insights, deep_insights } = profileData;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={clearSelection} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <button
            onClick={() => generateInsight(s.id)}
            className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm"
          >
            Generate Deep Insight
          </button>
        </div>

        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{s.first_name} {s.middle_name} {s.last_name}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">ID:</span> <span className="text-white">{s.staff_id}</span></div>
            <div><span className="text-gray-500">Job Title:</span> <span className="text-white">{s.job_title}</span></div>
            <div><span className="text-gray-500">Department:</span> <span className="text-white">{s.department}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="text-white">{s.employment_status}</span></div>
            <div><span className="text-gray-500">Type:</span> <span className="text-white">{s.employment_type}</span></div>
            <div><span className="text-gray-500">Hire Date:</span> <span className="text-white">{s.hire_date}</span></div>
          </div>

          {/* DBS Status */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded text-xs ${
              s.dbs_check_status === 'clear' ? 'bg-green-900/50 text-green-300' :
              s.dbs_check_status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' :
              s.dbs_check_status === 'expired' ? 'bg-red-900/50 text-red-300' :
              'bg-orange-900/50 text-orange-300'
            }`}>DBS: {s.dbs_check_status}</span>
            {s.dbs_expiry_date && <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded text-xs">Expires: {s.dbs_expiry_date}</span>}
          </div>
        </div>

        {/* Extended Profile */}
        {extended && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Extended Profile</h4>
            <div className="space-y-4 text-sm">
              {extended.career_goals && (
                <div><strong className="text-gray-400">Career Goals:</strong> <p className="text-gray-300 mt-1">{extended.career_goals}</p></div>
              )}
              {extended.professional_development && extended.professional_development.length > 0 && (
                <div><strong className="text-gray-400">Professional Development:</strong>
                  <ul className="mt-1 space-y-1">
                    {extended.professional_development.map((pd, idx) => (
                      <li key={idx} className="text-gray-300 bg-gray-800 rounded px-2 py-1">{typeof pd === 'string' ? pd : pd.title || JSON.stringify(pd)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {extended.mentorship_roles && extended.mentorship_roles.length > 0 && (
                <div><strong className="text-gray-400">Mentorship Roles:</strong>
                  <ul className="mt-1 space-y-1">
                    {extended.mentorship_roles.map((role, idx) => (
                      <li key={idx} className="text-gray-300 bg-gray-800 rounded px-2 py-1">{typeof role === 'string' ? role : role.title || JSON.stringify(role)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {extended.committee_memberships && extended.committee_memberships.length > 0 && (
                <div><strong className="text-gray-400">Committee Memberships:</strong>
                  <ul className="mt-1 space-y-1">
                    {extended.committee_memberships.map((cm, idx) => (
                      <li key={idx} className="text-gray-300 bg-gray-800 rounded px-2 py-1">{typeof cm === 'string' ? cm : cm.name || JSON.stringify(cm)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-cyan-400 mb-4">Certifications ({certifications.length})</h4>
            <div className="space-y-2">
              {certifications.map(cert => (
                <div key={cert.id} className="bg-gray-800 rounded p-3 border border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{cert.certification_name}</p>
                      {cert.issuing_body && <p className="text-gray-400 text-xs">{cert.issuing_body}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      cert.status === 'valid' ? 'bg-green-900/50 text-green-300' :
                      cert.status === 'expiring' ? 'bg-yellow-900/50 text-yellow-300' :
                      cert.status === 'expired' ? 'bg-red-900/50 text-red-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>{cert.status}</span>
                  </div>
                  {cert.expiry_date && <p className="text-gray-500 text-xs mt-1">Expires: {cert.expiry_date}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deep Insights */}
        {deep_insights && deep_insights.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-purple-400 mb-4">Deep Insights ({deep_insights.length})</h4>
            <div className="space-y-3">
              {deep_insights.map(insight => (
                <div key={insight.id} className="bg-gray-800 rounded p-4 border border-gray-700">
                  <p className="text-gray-200 text-sm">{insight.summary}</p>
                  {insight.alerts && insight.alerts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {insight.alerts.map((alert, idx) => (
                        <div key={idx} className={`text-xs px-2 py-1 rounded ${
                          alert.type === 'critical' ? 'bg-red-900/50 text-red-300' :
                          alert.type === 'warning' ? 'bg-yellow-900/50 text-yellow-300' :
                          'bg-blue-900/50 text-blue-300'
                        }`}>
                          <strong>{alert.title}:</strong> {alert.description}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">Generated: {new Date(insight.generatedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white mb-4">Staff Profiles</h2>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-timsys-primary"
          />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-timsys-primary"
          >
            <option value="">All Departments</option>
            {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No staff found</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Name</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">ID</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Job Title</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Department</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Status</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(member => (
                <tr key={member.id} className="border-b border-gray-800 hover:bg-gray-850">
                  <td className="px-4 py-3 text-white">{member.first_name} {member.last_name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{member.staff_id}</td>
                  <td className="px-4 py-3 text-gray-300">{member.job_title}</td>
                  <td className="px-4 py-3 text-gray-300">{member.department}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      member.employment_status === 'active' ? 'bg-green-900/50 text-green-300' :
                      member.employment_status === 'leave' ? 'bg-yellow-900/50 text-yellow-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>{member.employment_status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewProfile(member)}
                      className="text-timsys-primary hover:text-white text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default StaffProfileWidget;
