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
  return config;
});

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
export const listTeacherPreferenceCycles = (params = {}) => client.get("/teacher-preferences/cycles", { params });
export const createTeacherPreferenceCycle = (data) => client.post("/teacher-preferences/cycles", data);
export const openTeacherPreferenceCycle = (id) => client.put(`/teacher-preferences/cycles/${id}/open`);
export const closeTeacherPreferenceCycle = (id) => client.put(`/teacher-preferences/cycles/${id}/close`);
export const listTeacherPreferences = (params = {}) => client.get("/teacher-preferences", { params });
export const createTeacherPreference = (data) => client.post("/teacher-preferences", data);
export const submitTeacherPreference = (id, expectedRevision) => client.put(`/teacher-preferences/${id}/submit`, { expected_revision: expectedRevision });
export const withdrawTeacherPreference = (id, reason, expectedRevision) => client.put(`/teacher-preferences/${id}/withdraw`, { reason, expected_revision: expectedRevision });
export const reviewTeacherRestriction = (id, decision, reason, expectedRevision) => client.post(`/teacher-preferences/${id}/review`, { decision, reason, expected_revision: expectedRevision });
export const getTeacherPreferenceInsights = () => client.get("/teacher-preferences/insights");
export const syncTeacherPreferences = (schedulerSetupId) => client.post("/teacher-preferences/sync-scheduler", { scheduler_setup_id: schedulerSetupId });
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

export const listStaff = (params = {}) => client.get("/staff", { params });
export const createStaff = (data) => client.post("/staff", data);
export const updateStaff = (id, data) => client.put(`/staff/${id}`, data);
export const withdrawStaff = (id, data) =>
  client.put(`/staff/${id}/withdraw`, data);
export const reinstateStaff = (id, data = {}) =>
  client.put(`/staff/${id}/reinstate`, data);
export const deleteStaff = (id, reason) =>
  client.delete(`/staff/${id}/permanent`, { data: { reason } });
export const importStaff = (input, signal) =>
  postCsv("/api/staff/import", input, signal);

export const listRooms = (params = {}) => client.get("/rooms", { params });
export const createRoom = (data) => client.post("/rooms", data);
export const updateRoom = (id, data) => client.put(`/rooms/${id}`, data);
export const withdrawRoom = (id, data) =>
  client.put(`/rooms/${id}/withdraw`, data);
export const reinstateRoom = (id, data = {}) =>
  client.put(`/rooms/${id}/reinstate`, data);
export const deleteRoom = (id, reason) =>
  client.delete(`/rooms/${id}/permanent`, { data: { reason } });
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
export const listProgrammeOfferings = (id,params={}) => client.get(`/programme-manager/programmes/${id}/offerings`,{params});
export const listProgrammeSurveys = (id,params={}) => client.get(`/programme-manager/programmes/${id}/surveys`,{params});
export const listProgrammeResponses = (id,params={}) => client.get(`/programme-manager/surveys/${id}/responses`,{params});
export const reconcileProgrammeIdentities = id => client.post(`/programme-manager/surveys/${id}/reconcile-identities`,{limit:1000});
export const generateProgrammeAllocations = (id,data={}) => client.post(`/programme-manager/surveys/${id}/allocation-runs`,data);
export const listProgrammeAllocationRuns = (id,params={}) => client.get(`/programme-manager/surveys/${id}/allocation-runs`,{params});
export const getProgrammeAllocationRun = (id,params={}) => client.get(`/programme-manager/allocation-runs/${id}`,{params});
export const getProgrammeInterventions = (id,params={}) => client.get(`/programme-manager/allocation-runs/${id}/interventions`,{params});
export const decideProgrammeRecommendation = (id,data) => client.put(`/programme-manager/allocation-recommendations/${id}/decision`,data);
export const confirmProgrammeAllocationRun = (id,data) => client.put(`/programme-manager/allocation-runs/${id}/confirm`,data);
export const publishProgrammeEnrolments = (id,data) => client.post(`/programme-manager/allocation-runs/${id}/enrolments`,data);
export const listProgrammeEnrolments = (params={}) => client.get("/programme-manager/enrolments",{params});
export const withdrawProgrammeEnrolment = (id,data) => client.put(`/programme-manager/enrolments/${id}/withdraw`,data);
export const reinstateProgrammeEnrolment = (id,data) => client.put(`/programme-manager/enrolments/${id}/reinstate`,data);
export const getProgrammeOfferingRoster = id => client.get(`/programme-manager/offerings/${id}/roster`);
export const createProgrammeAttendanceHandoff = (id,data) => client.post(`/programme-manager/offerings/${id}/attendance-handoffs`,data);

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
