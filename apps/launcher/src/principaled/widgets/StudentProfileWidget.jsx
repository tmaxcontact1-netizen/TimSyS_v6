import React, { useState, useEffect } from 'react';
import * as api from '../client';

function StudentProfileWidget() {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [homeroomFilter, setHomeroomFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch students
  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await api.listStudents();
      setStudents(response.data?.students || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const nameMatch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const gradeMatch = !gradeFilter || s.current_grade_level === gradeFilter;
    const homeroomMatch = !homeroomFilter || s.homeroom === homeroomFilter;
    return nameMatch && gradeMatch && homeroomMatch;
  });

  // Get unique grades and homerooms
  const grades = [...new Set(students.map(s => s.current_grade_level).filter(Boolean))].sort();
  const homerooms = [...new Set(students.map(s => s.homeroom).filter(Boolean))].sort();

  // View profile
  const viewProfile = async (student) => {
    setSelectedStudent(student);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/students/${student.id}/profile`, {
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

  // Generate deep insight
  const generateInsight = async (studentId) => {
    try {
      const response = await fetch(`/students/${studentId}/profile/insights/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      alert('Deep insight generated!');
      // Reload profile
      await viewProfile(selectedStudent);
    } catch (err) {
      alert('Failed to generate insight: ' + err.message);
    }
  };

  const clearSelection = () => {
    setSelectedStudent(null);
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
  if (selectedStudent && profileData) {
    const { student, extended, contacts, enrollment_history, metadata, insights, deep_insights } = profileData;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={clearSelection} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <button 
            onClick={() => generateInsight(student.id)}
            className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm"
          >
            Generate Deep Insight
          </button>
        </div>

        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{student.first_name} {student.middle_name} {student.last_name}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">ID:</span> <span className="text-white">{student.student_id}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="text-white">{student.enrollment_status}</span></div>
            <div><span className="text-gray-500">Grade:</span> <span className="text-white">{student.current_grade_level}</span></div>
            <div><span className="text-gray-500">Homeroom:</span> <span className="text-white">{student.homeroom}</span></div>
            <div><span className="text-gray-500">DOB:</span> <span className="text-white">{student.date_of_birth}</span></div>
            <div><span className="text-gray-500">Language:</span> <span className="text-white">{student.primary_language}</span></div>
          </div>
          
          {(student.medical_alert_flag || student.special_education_flag || student.gifted_talented_flag) && (
            <div className="mt-4 flex gap-2">
              {student.medical_alert_flag && <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded text-xs">Medical Alert</span>}
              {student.special_education_flag && <span className="bg-yellow-900/50 text-yellow-300 px-2 py-1 rounded text-xs">Special Education</span>}
              {student.gifted_talented_flag && <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs">Gifted & Talented</span>}
            </div>
          )}
        </div>

        {/* Extended Profile */}
        {extended && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Extended Profile</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {extended.interests && Object.keys(extended.interests).length > 0 && (
                <div><strong className="text-gray-400">Interests:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(extended.interests).map(([k,v]) => v ? <span key={k} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{k}</span> : null)}
                  </div>
                </div>
              )}
              {extended.strengths && Object.keys(extended.strengths).length > 0 && (
                <div><strong className="text-gray-400">Strengths:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(extended.strengths).map(([k,v]) => v ? <span key={k} className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded">{k}</span> : null)}
                  </div>
                </div>
              )}
              {extended.goals && extended.goals.length > 0 && (
                <div><strong className="text-gray-400">Goals:</strong>
                  <p className="text-gray-300 mt-1">{extended.goals}</p>
                </div>
              )}
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
      <h2 className="text-2xl font-bold text-white mb-4">Student Profiles</h2>
      
      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-timsys-primary"
          />
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-timsys-primary"
          >
            <option value="">All Grades</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={homeroomFilter}
            onChange={(e) => setHomeroomFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-timsys-primary"
          >
            <option value="">All Homerooms</option>
            {homerooms.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No students found</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Name</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">ID</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Grade</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Homeroom</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300">Status</th>
                <th className="px-4 py-2 text-sm font-semibold text-gray-300"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id} className="border-b border-gray-800 hover:bg-gray-850">
                  <td className="px-4 py-3 text-white">{student.first_name} {student.last_name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{student.student_id}</td>
                  <td className="px-4 py-3 text-gray-300">{student.current_grade_level}</td>
                  <td className="px-4 py-3 text-gray-300">{student.homeroom}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      student.enrollment_status === 'active' ? 'bg-green-900/50 text-green-300' :
                      student.enrollment_status === 'suspended' ? 'bg-yellow-900/50 text-yellow-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>{student.enrollment_status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewProfile(student)}
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

export default StudentProfileWidget;
