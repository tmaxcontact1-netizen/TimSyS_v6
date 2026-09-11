import axios from "axios";

const client = axios.create({
  baseURL: "/",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = String(config.method || "get").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    config.__timsysAction = { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, method };
    globalThis.window?.dispatchEvent(new CustomEvent("timsys:action-feedback", { detail: { ...config.__timsysAction, phase: "working" } }));
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    if (response.config.__timsysAction) globalThis.window?.dispatchEvent(new CustomEvent("timsys:action-feedback", { detail: { ...response.config.__timsysAction, phase: "success" } }));
    return response;
  },
  (error) => {
    if (error.config?.__timsysAction) globalThis.window?.dispatchEvent(new CustomEvent("timsys:action-feedback", { detail: { ...error.config.__timsysAction, phase: "error" } }));
    return Promise.reject(error);
  },
);

export const get = (url) => client.get(url);
export const getGradebookManifest = () => client.get("/gradebook/manifest");
export const getGradebookInsights = () => client.get("/gradebook/insights");
export const listGradebooks = (params = {}) => client.get("/gradebooks", { params });
export const getGradebookReportingPeriods = (id) => client.get(`/gradebooks/${id}/reporting-periods`);
export const getGradebookWorkspace = (id, params = {}) => client.get(`/gradebooks/${id}/workspace`, { params });
export const listAcademicYears = (params = {}) => client.get("/academic-structure/years", { params });
export const getSchedulerSetup = (academicYearId) => client.get("/scheduler/setup", { params: { academic_year_id: academicYearId } });
export const saveSchedulerSetup = (data) => client.put("/scheduler/setup", data);
export const getSchedulerInsights = (schedulerSetupId) => client.get("/scheduler/insights", { params: { scheduler_setup_id: schedulerSetupId } });
export const listSchedulerVersions = (schedulerSetupId, params = {}) => client.get("/scheduler/versions", { params: { scheduler_setup_id: schedulerSetupId, ...params } });
export const generateSchedules = (data) => client.post("/scheduler/generate", data);
export const selectScheduleDraft = (id, expectedRevision) => client.put(`/scheduler/versions/${id}/select`, { expected_revision: expectedRevision });
export const submitSchedule = (id, reason, expectedRevision) => client.put(`/scheduler/versions/${id}/submit`, { reason, expected_revision: expectedRevision });
export const approveSchedule = (id, reason, expectedRevision) => client.put(`/scheduler/versions/${id}/approve`, { reason, expected_revision: expectedRevision });
export const rejectSchedule = (id, reason, expectedRevision) => client.put(`/scheduler/versions/${id}/reject`, { reason, expected_revision: expectedRevision });
export const publishSchedule = (id, reason, expectedRevision) => client.put(`/scheduler/versions/${id}/publish`, { reason, expected_revision: expectedRevision });
export const listSchedulerScopes = (scheduler_setup_id,params={}) => client.get("/scheduler/scopes",{params:{scheduler_setup_id,...params}});
export const createSchedulerScope = data => client.post("/scheduler/scopes",data);
export const updateSchedulerScope = (id,data) => client.put(`/scheduler/scopes/${id}`,data);
export const withdrawSchedulerScope = id => client.put(`/scheduler/scopes/${id}/withdraw`,{});
export const reinstateSchedulerScope = id => client.put(`/scheduler/scopes/${id}/reinstate`,{});
export const getSchedulerStructures = scheduler_setup_id => client.get("/scheduler/structures",{params:{scheduler_setup_id}});
export const saveSchedulerStructures = data => client.put("/scheduler/structures",data);
export const getSchedulerRules = scheduler_setup_id => client.get("/scheduler/rules",{params:{scheduler_setup_id}});
export const saveSchedulerRules = data => client.put("/scheduler/rules",data);
export const getSchedulerRequirements = scheduler_setup_id => client.get("/scheduler/requirements",{params:{scheduler_setup_id}});
export const saveSchedulerRequirements = data => client.put("/scheduler/requirements",data);
export const validateScheduleCandidates = data => client.post("/scheduler/candidates/validate",data);
export const getSchedulerValidationRun = id => client.get(`/scheduler/validation-runs/${id}`);
export const upsertSchedulerProviderRecords = (provider,data) => client.put(`/scheduler/providers/${provider}/records`,data);
export const listSchedulerProviderRecords = (provider,params={}) => client.get(`/scheduler/providers/${provider}/records`,{params});
export const listSchedulerProgrammeWindows = params => client.get("/scheduler/programme-windows",{params});
export const getSchedulerProgrammeWindowAvailability = (placementId,params) => client.get(`/scheduler/programme-windows/${placementId}/availability`,{params});
export const setSchedulePlacementLock = (versionId,placementId,data) => client.put(`/scheduler/versions/${versionId}/placements/${placementId}/lock`,data);
export const overrideSchedulePlacement = (versionId,placementId,data) => client.put(`/scheduler/versions/${versionId}/placements/${placementId}/override`,data);
export const listTeacherPreferenceCycles = (params = {}) => client.get("/teacher-preferences/cycles", { params });
export const createTeacherPreferenceCycle = (data) => client.post("/teacher-preferences/cycles", data);
export const openTeacherPreferenceCycle = (id) => client.put(`/teacher-preferences/cycles/${id}/open`);
export const closeTeacherPreferenceCycle = (id) => client.put(`/teacher-preferences/cycles/${id}/close`);
export const listTeacherPreferences = (params = {}) => client.get("/teacher-preferences", { params });
export const createTeacherPreference = (data) => client.post("/teacher-preferences", data);
export const reviseTeacherPreference = (id,data) => client.put(`/teacher-preferences/${id}`,data);
export const submitTeacherPreference = (id, expectedRevision) => client.put(`/teacher-preferences/${id}/submit`, { expected_revision: expectedRevision });
export const withdrawTeacherPreference = (id, reason, expectedRevision) => client.put(`/teacher-preferences/${id}/withdraw`, { reason, expected_revision: expectedRevision });
export const reviewTeacherRestriction = (id, decision, reason, expectedRevision) => client.post(`/teacher-preferences/${id}/review`, { decision, reason, expected_revision: expectedRevision });
export const getTeacherPreferenceInsights = () => client.get("/teacher-preferences/insights");
export const syncTeacherPreferences = (schedulerSetupId) => client.post("/teacher-preferences/sync-scheduler", { scheduler_setup_id: schedulerSetupId });
export const getTeacherPreferencesContract = () => client.get("/teacher-preferences/contract");
export const listTeacherPreferenceProviderRecords = (params={}) => client.get("/teacher-preferences/provider-records",{params});
export const getTeacherPreferenceStaffHistory = staffId => client.get(`/teacher-preferences/staff/${staffId}/history`);
export const getCoverInsights = () => client.get("/cover/insights");
export const getCoverAnalytics = (params={}) => client.get("/cover/analytics",{params});
export const getCoverPolicy = () => client.get("/cover/policy");
export const saveCoverPolicy = data => client.put("/cover/policy",data);
export const listCoverAbsences = (params={}) => client.get("/cover/absences",{params});
export const createCoverAbsence = data => client.post("/cover/absences",data);
export const cancelCoverAbsence = (id,data) => client.put(`/cover/absences/${id}/cancel`,data);
export const reinstateCoverAbsence = (id,data={}) => client.put(`/cover/absences/${id}/reinstate`,data);
export const reconcileCoverAbsence = (id,data={}) => client.post(`/cover/absences/${id}/reconcile`,data);
export const listCoverDemands = (params={}) => client.get("/cover/demands",{params});
export const cancelCoverDemand = (id,data) => client.put(`/cover/demands/${id}/cancel`,data);
export const reinstateCoverDemand = (id,data={}) => client.put(`/cover/demands/${id}/reinstate`,data);
export const generateCoverRecommendations = (id,data={}) => client.post(`/cover/demands/${id}/recommendations/generate`,data);
export const listCoverRecommendationRuns = (id,params={}) => client.get(`/cover/demands/${id}/recommendation-runs`,{params});
export const listCoverAssignments = id => client.get(`/cover/demands/${id}/assignments`);
export const confirmCoverAssignment = (id,data) => client.post(`/cover/demands/${id}/assignments`,data);
export const reassignCover = (id,data) => client.post(`/cover/assignments/${id}/reassign`,data);
export const cancelCoverAssignment = (id,data) => client.post(`/cover/assignments/${id}/cancel`,data);
export const completeCoverAssignment = (id,data={}) => client.post(`/cover/assignments/${id}/complete`,data);
export const rejectCoverRecommendation = (id,data) => client.post(`/cover/recommendations/${id}/reject`,data);
export const getCoverContract = () => client.get("/cover/contract");
export const listCoverPolicyHistory = (params={}) => client.get("/cover/policy/history",{params});
export const evaluateCoverEligibility = data => client.post("/cover/eligibility/evaluate",data);
export const updateCoverAbsence = (id,data) => client.put(`/cover/absences/${id}`,data);
export const getCoverRecommendationRun = id => client.get(`/cover/recommendation-runs/${id}`);
export const listStudents = (params = {}) =>
  client.get("/students", { params });
export const createStudent = (data) => client.post("/students", data);
export const updateStudent = (id, data) => client.put(`/students/${id}`, data);
export const withdrawStudent = (id, data) =>
  client.put(`/students/${id}/withdraw`, data);
export const reinstateStudent = (id, data = {}) =>
  client.put(`/students/${id}/reinstate`, data);
export const deleteStudent = (id, reason) =>
  client.delete(`/students/${id}/permanent`, { data: { reason } });
export const listStudentContacts = (id) => client.get(`/students/${id}/contacts`);
export const addStudentContact = (id, data) => client.post(`/students/${id}/contacts`, data);
export const getStudentEnrollmentHistory = (id) => client.get(`/students/${id}/enrollment-history`);

const postCsv = async (url, input, signal) => {
  const file = input instanceof FormData ? input.get("csv_file") : input;
  if (!file || typeof file.text !== "function")
    throw new Error("Select a CSV file before uploading");
  const csv = await file.text();
  if (!csv.trim()) throw new Error("The selected CSV file is empty");
  if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
  return client.post(url, { csv }, { signal });
};

export const importStudents = (input, signal) =>
  postCsv("/api/students/import", input, signal);
export const listStudentProfiles = (params = {}) => client.get("/student-profiles", { params });
export const getStudentProfile = (id) => client.get(`/students/${id}/profile`);
export const updateStudentExtendedProfile = (id, data) => client.put(`/students/${id}/profile/extended`, data);
export const generateStudentProfileInsight = (id) => client.post(`/students/${id}/profile/insights/generate`, {});

export const listStaff = (params = {}) => client.get("/staff", { params });
export const createStaff = (data) => client.post("/staff", data);
export const updateStaff = (id, data) => client.put(`/staff/${id}`, data);
export const withdrawStaff = (id, data) =>
  client.put(`/staff/${id}/withdraw`, data);
export const reinstateStaff = (id, data = {}) =>
  client.put(`/staff/${id}/reinstate`, data);
export const deleteStaff = (id, reason) =>
  client.delete(`/staff/${id}/permanent`, { data: { reason } });
export const listStaffCertifications = (id) => client.get(`/staff/${id}/certifications`);
export const addStaffCertification = (id, data) => client.post(`/staff/${id}/certifications`, data);
export const importStaff = (input, signal) =>
  postCsv("/api/staff/import", input, signal);
export const listStaffProfiles = (params = {}) => client.get("/staff-profiles", { params });
export const getStaffProfile = (id) => client.get(`/staff/${id}/profile`);
export const updateStaffExtendedProfile = (id, data) => client.put(`/staff/${id}/profile/extended`, data);
export const generateStaffProfileInsight = (id) => client.post(`/staff/${id}/profile/insights/generate`, {});

export const listRooms = (params = {}) => client.get("/rooms", { params });
export const createRoom = (data) => client.post("/rooms", data);
export const updateRoom = (id, data) => client.put(`/rooms/${id}`, data);
export const withdrawRoom = (id, data) =>
  client.put(`/rooms/${id}/withdraw`, data);
export const reinstateRoom = (id, data = {}) =>
  client.put(`/rooms/${id}/reinstate`, data);
export const deleteRoom = (id, reason) =>
  client.delete(`/rooms/${id}/permanent`, { data: { reason } });
export const listRoomBookings = (id) => client.get(`/rooms/${id}/bookings`);
export const importRooms = (input, signal) =>
  postCsv("/api/rooms/import", input, signal);

export const listInventory = (params = {}) =>
  client.get("/inventory", { params });
export const createItem = (data) => client.post("/inventory", data);
export const updateItem = (id, data) => client.put(`/inventory/${id}`, data);
export const withdrawItem = (id, data) =>
  client.put(`/inventory/${id}/withdraw`, data);
export const reinstateItem = (id, data = {}) =>
  client.put(`/inventory/${id}/reinstate`, data);
export const deleteItem = (id, reason) =>
  client.delete(`/inventory/${id}/permanent`, { data: { reason } });
export const listInventoryCheckouts = (id) => client.get(`/inventory/${id}/checkouts`);
export const importInventory = (input, signal) =>
  postCsv("/api/inventory/import", input, signal);

export const getCalendarSettings = () => client.get("/calendar/settings");
export const updateCalendarSettings = (data) => client.put("/calendar/settings", data);
export const listCalendarLayers = () => client.get("/calendar/layers");
export const listCalendarEntries = (params = {}) => client.get("/calendar/entries", { params });
export const createCalendarEntry = (data) => client.post("/calendar/entries", data);
export const updateCalendarEntry = (id, data) => client.put(`/calendar/entries/${id}`, data);
export const deleteCalendarEntry = (id) => client.delete(`/calendar/entries/${id}`);
export const setCalendarEntryStatus = (id, status) => client.put(`/calendar/entries/${id}/status`, { status });
export const setCalendarException = (id, data) => client.post(`/calendar/entries/${id}/exceptions`, data);
export const getCalendarEntryAudit = (id) => client.get(`/calendar/entries/${id}/audit`);
export const publishCalendarEntry = (id, data = {}) => client.post(`/calendar/entries/${id}/publish`, data);
export const withdrawCalendarPublication = (id) => client.delete(`/calendar/entries/${id}/publication`);
export const findCalendarConflicts = (params) => client.get("/calendar/conflicts", { params });
export const rolloverCalendar = (targetYear) => client.post("/calendar/rollover", { target_year: targetYear });
export const getPublicCalendar = () => client.get("/public/calendar", { params: { app_id: "principal-ed" } });
export const getCommunicationHistory = (id) => client.get(`/communications/${id}/history`);

export const listResponsibilities = (params = {}) => client.get("/ownership/responsibilities", { params });
export const assignResponsibility = (data) => client.post("/ownership/responsibilities", data);
export const updateResponsibility = (id, data) => client.put(`/ownership/responsibilities/${id}`, data);
export const setResponsibilityStatus = (id, status, reason) => client.put(`/ownership/responsibilities/${id}/status`, { status, reason });
export const addResponsibilityContributor = (id, data) => client.post(`/ownership/responsibilities/${id}/contributors`, data);
export const delegateResponsibility = (id, data) => client.post(`/ownership/responsibilities/${id}/delegate`, data);
export const handoverResponsibility = (id, data) => client.post(`/ownership/responsibilities/${id}/handover`, data);
export const escalateResponsibility = (id, data) => client.post(`/ownership/responsibilities/${id}/escalate`, data);
export const getResponsibilityHistory = (id) => client.get(`/ownership/responsibilities/${id}/history`);

export const listTasks = (params = {}) => client.get("/tasks", { params });
export const createTask = (data) => client.post("/tasks", data);
export const updateTask = (id, data) => client.put(`/tasks/${id}`, data);
export const setTaskStatus = (id, status, reason) => client.put(`/tasks/${id}/status`, { status, reason });
export const addTaskDependency = (id, data) => client.post(`/tasks/${id}/dependencies`, data);
export const removeTaskDependency = (id, dependencyId) => client.delete(`/tasks/${id}/dependencies/${dependencyId}`);
export const getTaskHistory = (id) => client.get(`/tasks/${id}/history`);

export const listApprovalRequests = (params = {}) => client.get("/approvals/requests", { params });
export const createApprovalRequest = (data) => client.post("/approvals/requests", data);
export const updateApprovalRequest = (id, data) => client.put(`/approvals/requests/${id}`, data);
export const submitApprovalRequest = (id, reason) => client.post(`/approvals/requests/${id}/submit`, { reason });
export const setApprovalRequestStatus = (id, status, reason) => client.put(`/approvals/requests/${id}/status`, { status, reason });
export const decideApprovalStage = (id, stageId, data) => client.post(`/approvals/requests/${id}/stages/${stageId}/decisions`, data);
export const getApprovalHistory = (id) => client.get(`/approvals/requests/${id}/history`);

export const listDocuments = (params = {}) => client.get("/documents", { params });
export const createDocument = (data) => client.post("/documents", data);
export const updateDocument = (id, data) => client.put(`/documents/${id}`, data);
export const setDocumentStatus = (id, status) => client.put(`/documents/${id}/status`, { status });
export const addDocumentLink = (id, data) => client.post(`/documents/${id}/links`, data);
export const removeDocumentLink = (id, linkId) => client.delete(`/documents/${id}/links/${linkId}`);
export const addDocumentVersion = (id, data) => client.post(`/documents/${id}/versions`, data);
export const getDocumentContent = (id, versionId) => client.get(`/documents/${id}/versions/${versionId}/content`);
export const getDocumentHistory = (id) => client.get(`/documents/${id}/history`);

export const listCommunications = (params = {}) => client.get("/communications", { params });
export const createCommunication = (data) => client.post("/communications", data);
export const updateCommunication = (id, data) => client.put(`/communications/${id}`, data);
export const dispatchCommunication = (id) => client.post(`/communications/${id}/dispatch`, {});
export const processCommunicationOutbox = () => client.post("/communications/outbox/process", {});
export const setCommunicationStatus = (id, status) => client.put(`/communications/${id}/status`, { status });
export const markCommunicationRead = (id, recipientId) => client.post(`/communications/${id}/recipients/${recipientId}/read`, {});
export const listCommunicationTemplates = (params = {}) => client.get("/communications/templates", { params });
export const createCommunicationTemplate = (data) => client.post("/communications/templates", data);
export const updateCommunicationTemplate = (id, data) => client.put(`/communications/templates/${id}`, data);
export const setCommunicationTemplateStatus = (id, status) => client.put(`/communications/templates/${id}/status`, { status });

export const listAudiences = (params={}) => client.get("/audiences",{params});
export const createAudience = data => client.post("/audiences",data);
export const updateAudience = (id,data) => client.put(`/audiences/${id}`,data);
export const setAudienceStatus = (id,status) => client.put(`/audiences/${id}/status`,{status});
export const addAudienceMember = (id,data) => client.post(`/audiences/${id}/members`,data);
export const setAudienceMemberStatus = (id,memberId,status) => client.put(`/audiences/${id}/members/${memberId}/status`,{status});
export const listInvitations = (params={}) => client.get("/invitations",{params});
export const createInvitation = data => client.post("/invitations",data);
export const respondInvitation = (id,data) => client.put(`/invitations/${id}/respond`,data);
export const setInvitationStatus = (id,status) => client.put(`/invitations/${id}/status`,{status});
export const listAttendanceSessions = (params={}) => client.get("/attendance/sessions",{params});
export const createAttendanceSession = data => client.post("/attendance/sessions",data);
export const updateAttendanceSession = (id,data) => client.put(`/attendance/sessions/${id}`,data);
export const setAttendanceSessionStatus = (id,status) => client.put(`/attendance/sessions/${id}/status`,{status});
export const upsertAttendanceRecord = (id,data) => client.post(`/attendance/sessions/${id}/records`,data);
export const seedAttendanceExpectedRoster = (id,studentIds) => client.post(`/attendance/sessions/${id}/expected-roster`,{student_ids:studentIds,source:"principaled_ui"});
export const listVenueBookings = (params={}) => client.get("/venue-bookings",{params});
export const checkVenueAvailability = params => client.get("/venue-bookings/availability",{params});
export const createVenueBooking = data => client.post("/venue-bookings",data);
export const updateVenueBooking = (id,data) => client.put(`/venue-bookings/${id}`,data);
export const setVenueBookingStatus = (id,status) => client.put(`/venue-bookings/${id}/status`,{status});
export const listResourceReservations = (params={}) => client.get("/resource-reservations",{params});
export const checkResourceAvailability = params => client.get("/resource-reservations/availability",{params});
export const createResourceReservation = data => client.post("/resource-reservations",data);
export const updateResourceReservation = (id,data) => client.put(`/resource-reservations/${id}`,data);
export const setResourceReservationStatus = (id,status) => client.put(`/resource-reservations/${id}/status`,{status});
export const listTransportProviders = (params={}) => client.get("/transport/providers",{params});
export const createTransportProvider = data => client.post("/transport/providers",data);
export const updateTransportProvider = (id,data) => client.put(`/transport/providers/${id}`,data);
export const setTransportProviderStatus = (id,status) => client.put(`/transport/providers/${id}/status`,{status});
export const listTransportVehicles = (params={}) => client.get("/transport/vehicles",{params});
export const createTransportVehicle = data => client.post("/transport/vehicles",data);
export const updateTransportVehicle = (id,data) => client.put(`/transport/vehicles/${id}`,data);
export const setTransportVehicleStatus = (id,status) => client.put(`/transport/vehicles/${id}/status`,{status});
export const listTransportJourneys = (params={}) => client.get("/transport/journeys",{params});
export const createTransportJourney = data => client.post("/transport/journeys",data);
export const updateTransportJourney = (id,data) => client.put(`/transport/journeys/${id}`,data);
export const setTransportJourneyStatus = (id,status) => client.put(`/transport/journeys/${id}/status`,{status});
export const addTransportPassenger = (id,data) => client.post(`/transport/journeys/${id}/passengers`,data);
export const setTransportPassengerStatus = (id,passengerId,status) => client.put(`/transport/journeys/${id}/passengers/${passengerId}/status`,{status});
export const listCateringProviders = (params={}) => client.get("/catering/providers",{params});
export const createCateringProvider = data => client.post("/catering/providers",data);
export const updateCateringProvider = (id,data) => client.put(`/catering/providers/${id}`,data);
export const setCateringProviderStatus = (id,status) => client.put(`/catering/providers/${id}/status`,{status});
export const listCateringPlans = (params={}) => client.get("/catering/plans",{params});
export const createCateringPlan = data => client.post("/catering/plans",data);
export const updateCateringPlan = (id,data) => client.put(`/catering/plans/${id}`,data);
export const setCateringPlanStatus = (id,status) => client.put(`/catering/plans/${id}/status`,{status});
export const listDietaryRequirements = (params={}) => client.get("/catering/dietary-requirements",{params});
export const createDietaryRequirement = data => client.post("/catering/dietary-requirements",data);
export const updateDietaryRequirement = (id,data) => client.put(`/catering/dietary-requirements/${id}`,data);
export const setDietaryRequirementStatus = (id,status) => client.put(`/catering/dietary-requirements/${id}/status`,{status});
export const listRiskAssessments = (params={}) => client.get("/risk/assessments",{params});
export const createRiskAssessment = data => client.post("/risk/assessments",data);
export const updateRiskAssessment = (id,data) => client.put(`/risk/assessments/${id}`,data);
export const setRiskAssessmentStatus = (id,status) => client.put(`/risk/assessments/${id}/status`,{status});
export const addRiskItem = (id,data) => client.post(`/risk/assessments/${id}/items`,data);
export const updateRiskItem = (id,itemId,data) => client.put(`/risk/assessments/${id}/items/${itemId}`,data);
export const listSafeguardingRequirements = (params={}) => client.get("/safeguarding/requirements",{params});
export const createSafeguardingRequirement = data => client.post("/safeguarding/requirements",data);
export const updateSafeguardingRequirement = (id,data) => client.put(`/safeguarding/requirements/${id}`,data);
export const setSafeguardingRequirementStatus = (id,status,verification_notes) => client.put(`/safeguarding/requirements/${id}/status`,{status,verification_notes});
export const listMedicalReferrals = (params={}) => client.get("/medical/referrals",{params});
export const createMedicalReferral = data => client.post("/medical/referrals",data);
export const updateMedicalReferral = (id,data) => client.put(`/medical/referrals/${id}`,data);
export const respondMedicalReferral = (id,data) => client.post(`/medical/referrals/${id}/respond`,data);
export const setMedicalReferralStatus = (id,status) => client.put(`/medical/referrals/${id}/status`,{status});
export const listStudentExits = (params={}) => client.get("/student-exits",{params});
export const getStudentExitsDashboard = (params={}) => client.get("/student-exits/dashboard",{params});
export const getStudentExitsAnalytics = (params={}) => client.get("/student-exits/analytics",{params});
export const getStudentExitsInsights = () => client.get("/student-exits/insights");
export const createStudentExit = data => client.post("/student-exits",data);
export const createStudentExitsBulk = data => client.post("/student-exits/bulk",data);
export const reconcileStudentExits = data => client.post("/student-exits/reconcile",data||{});
export const getStudentExit = id => client.get(`/student-exits/${id}`);
export const getStudentExitHistory = id => client.get(`/student-exits/${id}/history`);
export const getStudentExitNextActions = id => client.get(`/student-exits/${id}/next-actions`);
export const transitionStudentExit = (id,to_status,expected_status,operational_note) => client.post(`/student-exits/${id}/transitions`,{to_status,expected_status,operational_note});
export const authoriseCampusExit = (id,data) => client.post(`/student-exits/${id}/campus-authorisation`,data);
export const releaseCampusExit = (id,data) => client.post(`/student-exits/${id}/campus-release`,data);
export const closeCampusExit = (id,data) => client.post(`/student-exits/${id}/campus-close`,data);
export const getCampusExitHistory = id => client.get(`/student-exits/${id}/campus-history`);
export const getStudentExitContext = id => client.get(`/student-exits/${id}/context`);
export const listStudentExitLinks = id => client.get(`/student-exits/${id}/links`);
export const addStudentExitLink = (id,data) => client.post(`/student-exits/${id}/links`,data);
export const listStudentExitExceptions = id => client.get(`/student-exits/${id}/exceptions`);
export const reportStudentExitException = (id,data) => client.post(`/student-exits/${id}/exceptions`,data);
export const resolveStudentExitException = (id,exceptionId,data) => client.post(`/student-exits/${id}/exceptions/${exceptionId}/resolve`,data);
export const correctStudentExit = (id,data) => client.post(`/student-exits/${id}/corrections`,data);
export const listStudentExitTypes = () => client.get("/student-exits/config/types");
export const listStudentExitDestinations = () => client.get("/student-exits/config/destinations");
export const getStudentExitPolicy = () => client.get("/student-exits/config/policy");
export const saveStudentExitPolicy = data => client.put("/student-exits/config/policy",data);
export const listStudentExitStudentRules = studentId => client.get(`/student-exits/students/${studentId}/rules`);
export const saveStudentExitStudentRule = (studentId,data) => client.post(`/student-exits/students/${studentId}/rules`,data);
export const listStudentExitNotificationRules = () => client.get("/student-exits/config/notification-rules");
export const saveStudentExitNotificationRule = data => client.post("/student-exits/config/notification-rules",data);

export const listLateEntries = (params={}) => client.get("/late-entries",{params});
export const getLateEntriesDashboard = (params={}) => client.get("/late-entries/dashboard",{params});
export const getLateEntriesAnalytics = (params={}) => client.get("/late-entries/analytics",{params});
export const createLateEntry = data => client.post("/late-entries",data);
export const getLateEntry = id => client.get(`/late-entries/${id}`);
export const getLateEntryHistory = id => client.get(`/late-entries/${id}/history`);
export const correctLateEntry = (id,data) => client.post(`/late-entries/${id}/corrections`,data);
export const resolveLateEntryException = (id,exceptionId,data) => client.post(`/late-entries/${id}/exceptions/${exceptionId}/resolve`,data);
export const retryLateEntryContext = id => client.post(`/late-entries/${id}/context/retry`,{});
export const proposeLateEntryReconciliation = id => client.post(`/late-entries/${id}/reconciliation-proposals`,{});
export const applyLateEntryReconciliation = (id,runId,data) => client.post(`/late-entries/${id}/reconciliation-proposals/${runId}/apply`,data);
export const rejectLateEntryReconciliation = (id,runId,data) => client.post(`/late-entries/${id}/reconciliation-proposals/${runId}/reject`,data);
export const listLateEntryPolicies = () => client.get("/late-entries/config/policies");
export const createLateEntryPolicy = data => client.post("/late-entries/config/policies",data);
export const activateLateEntryPolicy = id => client.post(`/late-entries/config/policies/${id}/activate`,{confirmed_by_human:true});
export const listLateEntryReasons = () => client.get("/late-entries/config/reasons");
export const saveLateEntryReason = data => client.post("/late-entries/config/reasons",data);
export const listLateEntryThresholds = params => client.get("/late-entries/config/thresholds",{params});
export const saveLateEntryThreshold = data => client.post("/late-entries/config/thresholds",data);
export const listLateEntryThresholdCases = (params={}) => client.get("/late-entries/threshold-cases",{params});
export const decideLateEntryThreshold = (id,data) => client.post(`/late-entries/threshold-cases/${id}/decisions`,data);
export const listLateEntryEquivalences = (studentId,params={}) => client.get(`/late-entries/students/${studentId}/equivalences`,{params});
export const getLateEntryStudentProfileContribution = studentId => client.get(`/late-entries/students/${studentId}/profile-contribution`);
export const getLateEntryStaffProfileContribution = staffId => client.get(`/late-entries/staff/${staffId}/profile-contribution`);
export const calculateLateEntryEquivalence = (studentId,data) => client.post(`/late-entries/students/${studentId}/equivalences`,data);
export const confirmLateEntryEquivalence = (id,data) => client.post(`/late-entries/equivalences/${id}/confirm`,data);
export const evaluateLateEntryThresholds = (studentId,data) => client.post(`/late-entries/students/${studentId}/threshold-evaluations`,data);
export const previewLateEntryContext = data => client.post("/late-entries/context/preview",data);
export const getLateEntryActionPolicy = () => client.get("/late-entries/config/action-policy");
export const saveLateEntryActionPolicy = data => client.put("/late-entries/config/action-policy",data);
export const getLateEntryInsights = (params={}) => client.get("/late-entries/insights",{params});
export const listContingencyPlans = (params={}) => client.get("/contingency/plans",{params});
export const createContingencyPlan = data => client.post("/contingency/plans",data);
export const updateContingencyPlan = (id,data) => client.put(`/contingency/plans/${id}`,data);
export const setContingencyPlanStatus = (id,status,activation_notes) => client.put(`/contingency/plans/${id}/status`,{status,activation_notes});
export const addContingencyAction = (id,data) => client.post(`/contingency/plans/${id}/actions`,data);
export const updateContingencyAction = (id,actionId,data) => client.put(`/contingency/plans/${id}/actions/${actionId}`,data);
export const addContingencyResource = (id,data) => client.post(`/contingency/plans/${id}/resources`,data);
export const updateContingencyResource = (id,resourceId,data) => client.put(`/contingency/plans/${id}/resources/${resourceId}`,data);
export const resolveContingencyPlan = (id,resolution_summary) => client.post(`/contingency/plans/${id}/resolve`,{resolution_summary});
export const listFinancialBudgets = (params={}) => client.get("/finance/budgets",{params});
export const createFinancialBudget = data => client.post("/finance/budgets",data);
export const updateFinancialBudget = (id,data) => client.put(`/finance/budgets/${id}`,data);
export const setFinancialBudgetStatus = (id,status) => client.put(`/finance/budgets/${id}/status`,{status});
export const addFinancialEntry = (id,data) => client.post(`/finance/budgets/${id}/entries`,data);
export const updateFinancialEntry = (id,entryId,data) => client.put(`/finance/budgets/${id}/entries/${entryId}`,data);
export const listExpenditureRequests = (params={}) => client.get("/finance/requests",{params});
export const createExpenditureRequest = data => client.post("/finance/requests",data);
export const updateExpenditureRequest = (id,data) => client.put(`/finance/requests/${id}`,data);
export const setExpenditureRequestStatus = (id,status) => client.put(`/finance/requests/${id}/status`,{status});
export const reconcileExpenditureRequest = (id,data) => client.post(`/finance/requests/${id}/reconcile`,data);
export const listEvents = (params={}) => client.get("/events",{params});
export const getEvent = id => client.get(`/events/${id}`);
export const createEvent = data => client.post("/events",data);
export const updateEvent = (id,data) => client.put(`/events/${id}`,data);
export const setEventStatus = (id,status,reason) => client.put(`/events/${id}/status`,{status,reason});
export const getEventHistory = id => client.get(`/events/${id}/history`);
export const getEventPlannerManifest = () => client.get("/event-planner/manifest");
export const listEventPlans = (params={}) => client.get("/event-planner/events",{params});
export const getEventPlan = id => client.get(`/event-planner/events/${id}`);
export const getSystemHealth = () => client.get("/system-health");

export const getProgrammeManagerContract = () => client.get("/programme-manager/contract");
export const getProgrammeManagerInsights = () => client.get("/programme-manager/insights");
export const listManagedProgrammes = (params={}) => client.get("/programme-manager/programmes",{params});
export const createManagedProgramme = data => client.post("/programme-manager/programmes",data);
export const getManagedProgramme = id => client.get(`/programme-manager/programmes/${id}`);
export const updateManagedProgramme = (id,data) => client.put(`/programme-manager/programmes/${id}`,data);
export const withdrawManagedProgramme = (id,data) => client.put(`/programme-manager/programmes/${id}/withdraw`,data);
export const reinstateManagedProgramme = (id,data) => client.put(`/programme-manager/programmes/${id}/reinstate`,data);
export const getManagedProgrammeHistory = id => client.get(`/programme-manager/programmes/${id}/history`);
export const getProgrammeSetupSchema = () => client.get("/programme-manager/setup-schema");
export const getProgrammeSetup = id => client.get(`/programme-manager/programmes/${id}/setup`);
export const saveProgrammeSetupStep = (id,step,data) => client.put(`/programme-manager/programmes/${id}/setup/${step}`,data);
export const confirmProgrammeSetup = (id,data) => client.put(`/programme-manager/programmes/${id}/setup-confirmation`,data);
export const getProgrammeSetupHistory = id => client.get(`/programme-manager/programmes/${id}/setup-history`);
export const listProgrammeTemplates = (params={}) => client.get("/programme-manager/templates",{params});
export const createProgrammeTemplate = data => client.post("/programme-manager/templates",data);
export const getProgrammeTemplate = id => client.get(`/programme-manager/templates/${id}`);
export const updateProgrammeTemplate = (id,data) => client.put(`/programme-manager/templates/${id}`,data);
export const withdrawProgrammeTemplate = (id,data) => client.put(`/programme-manager/templates/${id}/withdraw`,data);
export const reinstateProgrammeTemplate = (id,data) => client.put(`/programme-manager/templates/${id}/reinstate`,data);
export const cloneProgrammeTemplate = (id,data) => client.post(`/programme-manager/templates/${id}/clone`,data);
export const getProgrammeTemplateHistory = id => client.get(`/programme-manager/templates/${id}/history`);
export const saveManagedProgrammeTemplate = (id,data) => client.post(`/programme-manager/programmes/${id}/save-template`,data);
export const applyProgrammeTemplate = (id,templateId,data) => client.put(`/programme-manager/programmes/${id}/apply-template/${templateId}`,data);
export const listProgrammeOfferings = (id,params={}) => client.get(`/programme-manager/programmes/${id}/offerings`,{params});
export const createProgrammeOffering = (id,data) => client.post(`/programme-manager/programmes/${id}/offerings`,data);
export const getProgrammeOfferingGraph = id => client.get(`/programme-manager/programmes/${id}/offering-graph`);
export const getProgrammeOffering = id => client.get(`/programme-manager/offerings/${id}`);
export const updateProgrammeOffering = (id,data) => client.put(`/programme-manager/offerings/${id}`,data);
export const confirmProgrammeOffering = (id,data) => client.put(`/programme-manager/offerings/${id}/confirm`,data);
export const withdrawProgrammeOffering = (id,data) => client.put(`/programme-manager/offerings/${id}/withdraw`,data);
export const reinstateProgrammeOffering = (id,data) => client.put(`/programme-manager/offerings/${id}/reinstate`,data);
export const getProgrammeOfferingHistory = id => client.get(`/programme-manager/offerings/${id}/history`);
export const listProgrammeSurveys = (id,params={}) => client.get(`/programme-manager/programmes/${id}/surveys`,{params});
export const createProgrammeSurvey = (id,data) => client.post(`/programme-manager/programmes/${id}/surveys`,data);
export const getProgrammeSurvey = id => client.get(`/programme-manager/surveys/${id}`);
export const saveProgrammeSurveyDesign = (id,data) => client.put(`/programme-manager/surveys/${id}/design`,data);
export const generateProgrammeSurveyDesign = (id,data={}) => client.post(`/programme-manager/surveys/${id}/generate`,data);
export const previewProgrammeSurvey = id => client.get(`/programme-manager/surveys/${id}/preview`);
export const publishProgrammeSurvey = (id,data) => client.put(`/programme-manager/surveys/${id}/publish`,data);
export const withdrawProgrammeSurvey = (id,data) => client.put(`/programme-manager/surveys/${id}/withdraw`,data);
export const reinstateProgrammeSurvey = (id,data) => client.put(`/programme-manager/surveys/${id}/reinstate`,data);
export const closeProgrammeSurvey = (id,data) => client.put(`/programme-manager/surveys/${id}/close`,data);
export const listProgrammeSurveyPublications = id => client.get(`/programme-manager/surveys/${id}/publications`);
export const getProgrammeSurveyPublication = (id,version) => client.get(`/programme-manager/surveys/${id}/publications/${version}`);
export const getProgrammeSurveyHistory = id => client.get(`/programme-manager/surveys/${id}/history`);
export const getPublicProgrammeSurvey = token => client.get(`/public/programme-surveys/${token}`);
export const submitPublicProgrammeResponse = (token,data) => client.post(`/public/programme-surveys/${token}/responses`,data);
export const revisePublicProgrammeResponse = (token,amendmentToken,data) => client.put(`/public/programme-surveys/${token}/responses/${amendmentToken}`,data);
export const listProgrammeResponses = (id,params={}) => client.get(`/programme-manager/surveys/${id}/responses`,{params});
export const submitProgrammeResponse = (id,data) => client.post(`/programme-manager/surveys/${id}/responses`,data);
export const importProgrammeResponses = (id,data) => client.post(`/programme-manager/surveys/${id}/responses/import`,data);
export const getProgrammeResponse = id => client.get(`/programme-manager/responses/${id}`);
export const reviseProgrammeResponse = (id,data) => client.put(`/programme-manager/responses/${id}`,data);
export const withdrawProgrammeResponse = (id,data) => client.put(`/programme-manager/responses/${id}/withdraw`,data);
export const getProgrammeResponseHistory = id => client.get(`/programme-manager/responses/${id}/history`);
export const reconcileProgrammeIdentities = id => client.post(`/programme-manager/surveys/${id}/reconcile-identities`,{limit:1000});
export const reconcileProgrammeResponse = id => client.post(`/programme-manager/responses/${id}/reconcile-identity`,{});
export const getProgrammeIdentityQueue = (params={}) => client.get("/programme-manager/identity-queue",{params});
export const decideProgrammeIdentity = (id,data) => client.put(`/programme-manager/responses/${id}/identity`,data);
export const getProgrammeIdentityHistory = id => client.get(`/programme-manager/responses/${id}/identity-history`);
export const listProgrammeDuplicateCases = (params={}) => client.get("/programme-manager/duplicate-cases",{params});
export const decideProgrammeDuplicateCase = (id,data) => client.put(`/programme-manager/duplicate-cases/${id}`,data);
export const getProgrammeDuplicateHistory = id => client.get(`/programme-manager/duplicate-cases/${id}/history`);
export const generateProgrammeAllocations = (id,data={}) => client.post(`/programme-manager/surveys/${id}/allocation-runs`,data);
export const listProgrammeAllocationRuns = (id,params={}) => client.get(`/programme-manager/surveys/${id}/allocation-runs`,{params});
export const getProgrammeAllocationRun = (id,params={}) => client.get(`/programme-manager/allocation-runs/${id}`,{params});
export const getProgrammeInterventions = (id,params={}) => client.get(`/programme-manager/allocation-runs/${id}/interventions`,{params});
export const decideProgrammeRecommendation = (id,data) => client.put(`/programme-manager/allocation-recommendations/${id}/decision`,data);
export const confirmProgrammeAllocationRun = (id,data) => client.put(`/programme-manager/allocation-runs/${id}/confirm`,data);
export const getProgrammeAllocationDecisionHistory = id => client.get(`/programme-manager/allocation-runs/${id}/decision-history`);
export const publishProgrammeEnrolments = (id,data) => client.post(`/programme-manager/allocation-runs/${id}/enrolments`,data);
export const listProgrammeEnrolments = (params={}) => client.get("/programme-manager/enrolments",{params});
export const withdrawProgrammeEnrolment = (id,data) => client.put(`/programme-manager/enrolments/${id}/withdraw`,data);
export const reinstateProgrammeEnrolment = (id,data) => client.put(`/programme-manager/enrolments/${id}/reinstate`,data);
export const getProgrammeEnrolmentHistory = id => client.get(`/programme-manager/enrolments/${id}/history`);
export const getProgrammeOfferingRoster = id => client.get(`/programme-manager/offerings/${id}/roster`);
export const createProgrammeAttendanceHandoff = (id,data) => client.post(`/programme-manager/offerings/${id}/attendance-handoffs`,data);
export const listProgrammeManagerSchedulerWindows = (params={}) => client.get("/programme-manager/scheduler-windows",{params});
export const getProgrammeManagerWindowAvailability = (id,params={}) => client.get(`/programme-manager/scheduler-windows/${id}/availability`,{params});

// Academic structure and gradebook operations. Enrolment mutations are intentionally
// exposed only for the owning scheduling/programme workflows, never from Gradebook UI.
export const listAcademicProgrammes = (params={}) => client.get("/academic-structure/programmes",{params});
export const createAcademicProgramme = data => client.post("/academic-structure/programmes",data);
export const listAcademicSubjects = (params={}) => client.get("/academic-structure/subjects",{params});
export const createAcademicSubject = data => client.post("/academic-structure/subjects",data);
export const listReportingPeriods = (params={}) => client.get("/academic-structure/reporting-periods",{params});
export const createReportingPeriod = data => client.post("/academic-structure/reporting-periods",data);
export const listTeachingGroups = (params={}) => client.get("/academic-structure/teaching-groups",{params});
export const createTeachingGroup = data => client.post("/academic-structure/teaching-groups",data);
export const assignTeachingGroupTeacher = (id,data) => client.post(`/academic-structure/teaching-groups/${id}/teachers`,data);
export const enrolTeachingGroupStudent = (id,data) => client.post(`/academic-structure/teaching-groups/${id}/students`,data);
export const withdrawTeachingGroupStudent = (id,studentId,data) => client.put(`/academic-structure/teaching-groups/${id}/students/${studentId}/withdraw`,data);
export const getGradebook = id => client.get(`/gradebooks/${id}`);
export const setGradebookMode = (id,mode) => client.put(`/gradebooks/${id}/mode`,{mode});
export const reconcileGradebooks = (data={}) => client.post("/gradebooks/reconcile",data);
export const listAssessmentCategories = () => client.get("/assessment-categories");
export const createAssessmentCategory = data => client.post("/assessment-categories",data);
export const listGradebookAssessments = (id,params={}) => client.get(`/gradebooks/${id}/assessments`,{params});
export const createGradebookAssessment = (id,data) => client.post(`/gradebooks/${id}/assessments`,data);
export const mapAssessmentStandard = (id,data) => client.post(`/assessments/${id}/standards`,data);
export const listAssessmentEvidence = (id,params={}) => client.get(`/assessments/${id}/evidence`,{params});
export const recordAssessmentEvidence = (id,data) => client.post(`/assessments/${id}/evidence`,data);
export const correctAssessmentEvidence = (id,data) => client.post(`/evidence/${id}/correct`,data);
export const listAssessmentScales = (params={}) => client.get("/assessment-scales",{params});
export const createAssessmentScale = data => client.post("/assessment-scales",data);
export const getAssessmentScale = id => client.get(`/assessment-scales/${id}`);
export const addAssessmentScaleLevel = (id,data) => client.post(`/assessment-scales/${id}/levels`,data);
export const activateAssessmentScale = id => client.put(`/assessment-scales/${id}/activate`,{});
export const versionAssessmentScale = (id,data={}) => client.post(`/assessment-scales/${id}/new-version`,data);
export const resolveAssessmentScale = (id,value) => client.post(`/assessment-scales/${id}/resolve`,{value});
export const listEvaluationPolicies = () => client.get("/evaluation-policies");
export const createEvaluationPolicy = data => client.post("/evaluation-policies",data);
export const activateEvaluationPolicy = id => client.put(`/evaluation-policies/${id}/activate`,{});
export const setEvaluationPolicyCategory = (id,data) => client.post(`/evaluation-policies/${id}/categories`,data);
export const assignEvaluationPolicy = (id,data) => client.post(`/evaluation-policies/${id}/assign`,data);
export const resolveGradebookPolicy = id => client.get(`/gradebooks/${id}/evaluation-policy`);
export const createClassAttendanceSession = (id,data) => client.post(`/gradebooks/${id}/attendance-sessions`,data);
export const recordAttendanceMark = (sessionId,studentId,data) => client.post(`/class-attendance-sessions/${sessionId}/students/${studentId}`,data);
export const correctAttendanceMark = (id,data) => client.post(`/class-attendance-marks/${id}/correct`,data);
export const getStudentAttendanceSummary = (id,studentId,params={}) => client.get(`/gradebooks/${id}/students/${studentId}/attendance-summary`,{params});
export const evaluateStudentGrade = (id,studentId,data={}) => client.post(`/gradebooks/${id}/students/${studentId}/evaluate`,data);
export const listStudentGradeResults = (id,studentId) => client.get(`/gradebooks/${id}/students/${studentId}/results`);
export const overrideGradeResult = (id,data) => client.post(`/grade-results/${id}/override`,data);
export const listStandardsFrameworks = (params={}) => client.get("/standards/frameworks",{params});
export const createStandardsFramework = data => client.post("/standards/frameworks",data);
export const getStandardsFramework = id => client.get(`/standards/frameworks/${id}`);
export const addLearningStandard = (id,data) => client.post(`/standards/frameworks/${id}/standards`,data);
export const activateStandardsFramework = id => client.put(`/standards/frameworks/${id}/activate`,{});
export const versionStandardsFramework = (id,data={}) => client.post(`/standards/frameworks/${id}/new-version`,data);
export const assignGradebookStandards = (id,framework_id) => client.post(`/gradebooks/${id}/standards-frameworks`,{framework_id});
export const listBehaviourFrameworks = (params={}) => client.get("/behaviour-frameworks",{params});
export const createBehaviourFramework = data => client.post("/behaviour-frameworks",data);
export const addBehaviourIndicator = (id,data) => client.post(`/behaviour-frameworks/${id}/indicators`,data);
export const activateBehaviourFramework = id => client.put(`/behaviour-frameworks/${id}/activate`,{});
export const assignGradebookBehaviourFramework = (id,framework_id) => client.put(`/gradebooks/${id}/behaviour-framework`,{framework_id});
export const recordBehaviourObservation = (id,studentId,data) => client.post(`/gradebooks/${id}/students/${studentId}/behaviour-observations`,data);
export const correctBehaviourObservation = (id,data) => client.post(`/behaviour-observations/${id}/correct`,data);
export const getBehaviourSummary = (id,studentId,params={}) => client.get(`/gradebooks/${id}/students/${studentId}/behaviour-summary`,{params});
export const generateAcademicCommentary = (id,studentId,grade_result_id) => client.post(`/gradebooks/${id}/students/${studentId}/commentary/generate`,{grade_result_id});
export const updateAcademicCommentary = (id,content) => client.put(`/commentary-drafts/${id}`,{content});
export const markAcademicCommentaryReady = id => client.put(`/commentary-drafts/${id}/ready`,{});
export const listAcademicCommentary = (id,studentId,params={}) => client.get(`/gradebooks/${id}/students/${studentId}/commentary`,{params});
export const createGradeReport = (id,studentId,data) => client.post(`/gradebooks/${id}/students/${studentId}/reports`,data);
export const submitGradeReport = id => client.post(`/grade-reports/${id}/submit`,{});
export const decideGradeReport = (id,data) => client.post(`/grade-reports/${id}/decision`,data);
export const publishGradeReport = id => client.post(`/grade-reports/${id}/publish`,{});
export const getGradeReport = id => client.get(`/grade-reports/${id}`);
export const listGradeReports = (id,studentId) => client.get(`/gradebooks/${id}/students/${studentId}/reports`);

export const listInsightProducts = (
  scopeType = "organisation",
  scopeId = "current",
  allScopes = false,
) =>
  client.get("/intelligence/products", {
    params: { scope_type: scopeType, scope_id: scopeId, all_scopes: allScopes },
  });
export const runWithdrawalAnalysis = (data = {}) =>
  client.post("/intelligence/providers/core.withdrawal-patterns/run", data);
export const listIntelligenceProviders = () =>
  client.get("/intelligence/providers");
export const runIntelligenceProvider = (id, data = {}) =>
  client.post(`/intelligence/providers/${id}/run`, data);
export const decideOnInsight = (id, data) =>
  client.post(`/intelligence/products/${id}/decisions`, data);
export const createIntelligenceAction = (data) =>
  client.post("/intelligence/actions", data);
export const listIntelligenceActions = (params = {}) =>
  client.get("/intelligence/actions", { params });
export const updateIntelligenceAction = (id, data) =>
  client.put(`/intelligence/actions/${id}`, data);
export const generateIntelligenceReminders = () =>
  client.post("/intelligence/reminders/generate", {});
export const recordIntelligenceOutcome = (data) =>
  client.post("/intelligence/outcomes", data);
export const getIntelligencePortfolio = (params={}) => client.get("/intelligence/portfolio",{params});
export const getIntelligenceHealth = () => client.get("/intelligence/health");
export const actOnIntelligenceProduct = (id,data) => client.post(`/intelligence/products/${id}/actions`,data);
export const getIntelligenceMetricSeries = (id,params={}) => client.get(`/intelligence/metrics/${id}`,{params});
export const assessIntelligenceOutcome = (id,data) => client.post(`/intelligence/outcomes/${id}/assess`,data);
export const getSchoolMetrics = () => client.get("/analytics/all-metrics");
export const getSchoolRatios = () => client.get("/analytics/ratios");
export const getSchoolInsights = () => client.get("/analytics/insights");
export const getSchoolAnalyticsDashboard = () => client.get("/analytics/dashboard");
export const getSchoolAnalyticsDocument = () => client.get("/analytics");
export const getBuilderTemplates = () => client.get("/builder/templates");
export const getBuilderUiStandard = () => client.get("/builder/ui-standard");
export const getBuilderComponents = () => client.get("/builder/components");
export const composeBuilderModule = data => client.post("/builder/compose",data);
export const validateBuilderModule = data => client.post("/builder/validate",data);
export const listBuilderDrafts = () => client.get("/builder/drafts");
export const activateBuilderDraft = moduleName => client.post(`/builder/drafts/${encodeURIComponent(moduleName)}/activate`,{});
