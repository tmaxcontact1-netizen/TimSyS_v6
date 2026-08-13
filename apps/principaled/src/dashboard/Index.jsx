import React, { useState, useEffect, useRef } from "react";
import * as api from "../api/client";
import OverviewWidget from "./widgets/OverviewWidget";
import StudentsWidget from "./widgets/StudentsWidget";
import StaffWidget from "./widgets/StaffWidget";
import RoomsWidget from "./widgets/RoomsWidget";
import InventoryWidget from "./widgets/InventoryWidget";
import StudentProfileWidget from "./widgets/StudentProfileWidget";
import StaffProfileWidget from "./widgets/StaffProfileWidget";
import ModuleStatusWidget from "./widgets/ModuleStatusWidget";
import IntelligenceWorkspace from "./widgets/IntelligenceWorkspace";
import CalendarWidget from "./widgets/CalendarWidget";
import OwnershipWidget from "./widgets/OwnershipWidget";
import TasksWidget from "./widgets/TasksWidget";
import ApprovalsWidget from "./widgets/ApprovalsWidget";
import DocumentsWidget from "./widgets/DocumentsWidget";
import CommunicationsWidget from "./widgets/CommunicationsWidget";
import ParticipationWidget from "./widgets/ParticipationWidget";
import CoordinationWidget from "./widgets/CoordinationWidget";
import TransportationWidget from "./widgets/TransportationWidget";
import CateringWidget from "./widgets/CateringWidget";
import SafetyWidget from "./widgets/SafetyWidget";
import ContingencyWidget from "./widgets/ContingencyWidget";
import FinanceWidget from "./widgets/FinanceWidget";
import EventsWidget from "./widgets/EventsWidget";
import EventPlannerWidget from "./widgets/EventPlannerWidget";

// Module to UI mapping - operational modules show in sidebar
const MODULE_TO_VIEW = {
  // Existing operational modules (non-admin)
  student_registry: {
    id: "students",
    label: "Students",
    widget: StudentsWidget,
    requiresAdmin: false,
  },
  staff_registry: {
    id: "staff",
    label: "Staff",
    widget: StaffWidget,
    requiresAdmin: false,
  },
  room_registry: {
    id: "rooms",
    label: "Rooms",
    widget: RoomsWidget,
    requiresAdmin: false,
  },
  inventory: {
    id: "inventory",
    label: "Inventory",
    widget: InventoryWidget,
    requiresAdmin: false,
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    widget: CalendarWidget,
    requiresAdmin: false,
  },
  ownership: {
    id: "ownership",
    label: "Ownership",
    widget: OwnershipWidget,
    requiresAdmin: false,
  },
  tasks: {
    id: "tasks",
    label: "Tasks",
    widget: TasksWidget,
    requiresAdmin: false,
  },
  approvals: {
    id: "approvals",
    label: "Approvals",
    widget: ApprovalsWidget,
    requiresAdmin: false,
  },
  documents: {
    id: "documents",
    label: "Documents",
    widget: DocumentsWidget,
    requiresAdmin: false,
  },
  communications: {
    id: "communications",
    label: "Communications",
    widget: CommunicationsWidget,
    requiresAdmin: false,
  },
  audiences: { id:"audiences",label:"Audiences",widget:ParticipationWidget,requiresAdmin:false },
  invitations: { id:"invitations",label:"Invitations",widget:ParticipationWidget,requiresAdmin:false },
  attendance: { id:"attendance",label:"Attendance",widget:ParticipationWidget,requiresAdmin:false },
  venue_bookings: { id:"venue_bookings",label:"Venue Bookings",widget:CoordinationWidget,requiresAdmin:false },
  resource_reservations: { id:"resource_reservations",label:"Resource Reservations",widget:CoordinationWidget,requiresAdmin:false },
  transportation: { id:"transportation",label:"Transportation",widget:TransportationWidget,requiresAdmin:false },
  catering: { id:"catering",label:"Catering",widget:CateringWidget,requiresAdmin:false },
  risk_assessments: { id:"risk_assessments",label:"Risk Assessments",widget:SafetyWidget,requiresAdmin:false },
  safeguarding_requirements: { id:"safeguarding_requirements",label:"Safeguarding",widget:SafetyWidget,requiresAdmin:false },
  medical_referrals: { id:"medical_referrals",label:"Medical Referrals",widget:SafetyWidget,requiresAdmin:false },
  contingency: { id:"contingency",label:"Contingency",widget:ContingencyWidget,requiresAdmin:false },
  financial_planning: { id:"financial_planning",label:"Finance",widget:FinanceWidget,requiresAdmin:false },
  event_record: { id:"event_record",label:"Events",widget:EventsWidget,requiresAdmin:false },
  event_planner: { id:"event_planner",label:"Event Planner",widget:EventPlannerWidget,requiresAdmin:false },
  // Profile widgets (non-admin)
  student_profile: {
    id: "student_profiles",
    label: "Student Profiles",
    widget: StudentProfileWidget,
    requiresAdmin: false,
  },
  staff_profile: {
    id: "staff_profiles",
    label: "Staff Profiles",
    widget: StaffProfileWidget,
    requiresAdmin: false,
  },
  // Backend modules (admin/dev only - render as module status pages)
  app_registry: {
    id: "backend_app_registry",
    label: "App Registry",
    widget: ModuleStatusWidget,
    moduleName: "app_registry",
    requiresAdmin: true,
  },
  auto_rules: {
    id: "backend_auto_rules",
    label: "Auto Rules",
    widget: ModuleStatusWidget,
    moduleName: "auto_rules",
    requiresAdmin: true,
  },
  builder: {
    id: "backend_builder",
    label: "Builder",
    widget: ModuleStatusWidget,
    moduleName: "builder",
    requiresAdmin: true,
  },
  decision_log: {
    id: "backend_decision_log",
    label: "Decision Log",
    widget: ModuleStatusWidget,
    moduleName: "decision_log",
    requiresAdmin: true,
  },
  event_store: {
    id: "backend_event_store",
    label: "Event Store",
    widget: ModuleStatusWidget,
    moduleName: "event_store",
    requiresAdmin: true,
  },
  insight_management: {
    id: "backend_insight_management",
    label: "Insight Management",
    widget: ModuleStatusWidget,
    moduleName: "insight_management",
    requiresAdmin: true,
  },
  intelligence: {
    id: "backend_intelligence",
    label: "Intelligence",
    widget: ModuleStatusWidget,
    moduleName: "intelligence",
    requiresAdmin: true,
  },
  knowledge_store: {
    id: "backend_knowledge_store",
    label: "Knowledge Store",
    widget: ModuleStatusWidget,
    moduleName: "knowledge_store",
    requiresAdmin: true,
  },
  notification: {
    id: "backend_notification",
    label: "Notification",
    widget: ModuleStatusWidget,
    moduleName: "notification",
    requiresAdmin: true,
  },
  relationship_registry: {
    id: "backend_relationship_registry",
    label: "Relationship Registry",
    widget: ModuleStatusWidget,
    moduleName: "relationship_registry",
    requiresAdmin: true,
  },
  snapshot_service: {
    id: "backend_snapshot_service",
    label: "Snapshot Service",
    widget: ModuleStatusWidget,
    moduleName: "snapshot_service",
    requiresAdmin: true,
  },
  system_health: {
    id: "backend_system_health",
    label: "System Health",
    widget: ModuleStatusWidget,
    moduleName: "system_health",
    requiresAdmin: true,
  },
  user_management: {
    id: "backend_user_management",
    label: "User Management",
    widget: ModuleStatusWidget,
    moduleName: "user_management",
    requiresAdmin: true,
  },
};

function PrincipalEdDashboard() {
  const [activeView, setActiveView] = useState(
    () => sessionStorage.getItem("principaled_active_view") || "overview",
  );
  const [userData, setUserData] = useState(null);
  const [data, setData] = useState({
    stats: null,
    students: [],
    staff: [],
    rooms: [],
    inventory: [],
  });
  const [enabledModules, setEnabledModules] = useState([]);
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [lists, setLists] = useState({
    students: { page: 1, total: 0, pageSize: 50, search: "" },
    staff: { page: 1, total: 0, pageSize: 50, search: "" },
    rooms: { page: 1, total: 0, pageSize: 50, search: "" },
    inventory: { page: 1, total: 0, pageSize: 50, search: "" },
  });
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const confirmationResolver = useRef(null);

  const askConfirmation = (options) =>
    new Promise((resolve) => {
      confirmationResolver.current = resolve;
      setConfirmation(options);
    });

  const closeConfirmation = (confirmed) => {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("jwt_token");
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  const fetchData = async (overrides = {}) => {
    try {
      const query = Object.fromEntries(
        Object.entries(listsRef.current).map(([key, value]) => [
          key,
          { ...value, ...(overrides[key] || {}) },
        ]),
      );
      const [studentsRes, staffRes, roomsRes, inventoryRes] =
        await Promise.allSettled([
          api.listStudents({
            page: query.students.page,
            limit: 50,
            q: query.students.search,
          }),
          api.listStaff({
            page: query.staff.page,
            limit: 50,
            q: query.staff.search,
          }),
          api.listRooms({
            page: query.rooms.page,
            limit: 50,
            q: query.rooms.search,
          }),
          api.listInventory({
            page: query.inventory.page,
            limit: 50,
            q: query.inventory.search,
          }),
        ]);

      setData({
        stats: null,
        students:
          studentsRes.status === "fulfilled"
            ? studentsRes.value.data.students || []
            : [],
        staff:
          staffRes.status === "fulfilled"
            ? staffRes.value.data.staff || []
            : [],
        rooms:
          roomsRes.status === "fulfilled"
            ? roomsRes.value.data.rooms || []
            : [],
        inventory:
          inventoryRes.status === "fulfilled"
            ? inventoryRes.value.data.items ||
              inventoryRes.value.data.inventory ||
              []
            : [],
      });
      setLists((current) => {
        const next = { ...current };
        for (const [key, response] of Object.entries({
          students: studentsRes,
          staff: staffRes,
          rooms: roomsRes,
          inventory: inventoryRes,
        })) {
          if (response.status === "fulfilled")
            next[key] = {
              ...query[key],
              total: response.value.data.total || 0,
              pageSize: 50,
            };
        }
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchEnabledModules = async () => {
    try {
      const token = localStorage.getItem("jwt_token");
      const response = await fetch("/modules/list-for-app?appId=principal-ed", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const enabled = (data.data || [])
        .filter((m) => m.enabled)
        .map((m) => m.name);
      setEnabledModules(enabled);
    } catch (err) {
      console.error("Failed to fetch modules:", err);
    } finally {
      setModulesLoaded(true);
    }
  };

  const updateList = (key, changes) => {
    const next = { ...listsRef.current[key], ...changes };
    setLists((current) => ({ ...current, [key]: next }));
    void fetchData({ [key]: next });
  };

  useEffect(() => {
    Promise.all([fetchData(), fetchEnabledModules(), fetchUserData()]).finally(
      () => setLoading(false),
    );
  }, []);

  const hasAdminPermission = () => {
    if (!userData || !userData.permissions) return false;
    const perms = Array.isArray(userData.permissions)
      ? userData.permissions
      : [];
    return (
      perms.includes("admin:*") || perms.some((p) => p.startsWith("admin:"))
    );
  };

  const navItems = [
    { id: "overview", label: "Overview" },
    { id: "intelligence_workspace", label: "Insights" },
    ...Object.keys(MODULE_TO_VIEW)
      .filter((moduleName) => {
        if (!enabledModules.includes(moduleName)) return false;
        if (MODULE_TO_VIEW[moduleName].requiresAdmin && !hasAdminPermission())
          return false;
        return true;
      })
      .map((moduleName) => ({
        id: MODULE_TO_VIEW[moduleName].id,
        label: MODULE_TO_VIEW[moduleName].label,
      })),
  ];

  const renderWidget = () => {
    if (activeView === "overview") {
      return <OverviewWidget data={data} />;
    }
    if (activeView === "intelligence_workspace")
      return <IntelligenceWorkspace />;

    const moduleEntry = Object.entries(MODULE_TO_VIEW).find(
      ([_, config]) => config.id === activeView,
    );
    if (!moduleEntry) return <div className="text-gray-500">Unknown view</div>;

    const [moduleName, config] = moduleEntry;

    if (moduleName === "student_registry") {
      return enabledModules.includes(moduleName) ? (
        <StudentsWidget
          students={data.students}
          onImport={handleImportStudents}
          onAdd={handleAddStudent}
          onEdit={handleEditStudent}
          onWithdraw={(id) =>
            handleWithdraw(api.withdrawStudent, id, "student")
          }
          onReinstate={(id) => handleLifecycle(api.reinstateStudent, id)}
          onDelete={handleDeleteStudent}
          pagination={lists.students}
          onPageChange={(page) => updateList("students", { page })}
          onSearch={(search) => updateList("students", { page: 1, search })}
        />
      ) : null;
    }
    if (moduleName === "staff_registry") {
      return enabledModules.includes(moduleName) ? (
        <StaffWidget
          staff={data.staff}
          onImport={handleImportStaff}
          onAdd={handleAddStaff}
          onEdit={handleEditStaff}
          onWithdraw={(id) =>
            handleWithdraw(api.withdrawStaff, id, "staff member")
          }
          onReinstate={(id) => handleLifecycle(api.reinstateStaff, id)}
          onDelete={handleDeleteStaff}
          pagination={lists.staff}
          onPageChange={(page) => updateList("staff", { page })}
          onSearch={(search) => updateList("staff", { page: 1, search })}
        />
      ) : null;
    }
    if (moduleName === "room_registry") {
      return enabledModules.includes(moduleName) ? (
        <RoomsWidget
          rooms={data.rooms}
          onImport={handleImportRooms}
          onAdd={handleAddRoom}
          onEdit={handleEditRoom}
          onWithdraw={(id) => handleWithdraw(api.withdrawRoom, id, "room")}
          onReinstate={(id) => handleLifecycle(api.reinstateRoom, id)}
          onDelete={handleDeleteRoom}
          pagination={lists.rooms}
          onPageChange={(page) => updateList("rooms", { page })}
          onSearch={(search) => updateList("rooms", { page: 1, search })}
        />
      ) : null;
    }
    if (moduleName === "inventory") {
      return enabledModules.includes(moduleName) ? (
        <InventoryWidget
          inventory={data.inventory}
          onImport={handleImportInventory}
          onAdd={handleAddInventory}
          onEdit={handleEditInventory}
          onWithdraw={(id) =>
            handleWithdraw(api.withdrawItem, id, "inventory item")
          }
          onReinstate={(id) => handleLifecycle(api.reinstateItem, id)}
          onDelete={handleDeleteInventory}
          pagination={lists.inventory}
          onPageChange={(page) => updateList("inventory", { page })}
          onSearch={(search) => updateList("inventory", { page: 1, search })}
        />
      ) : null;
    }
    if (moduleName === "calendar") {
      return <CalendarWidget askConfirmation={askConfirmation} />;
    }
    if (moduleName === "ownership") {
      return <OwnershipWidget askConfirmation={askConfirmation} />;
    }
    if (moduleName === "tasks") {
      return <TasksWidget askConfirmation={askConfirmation} />;
    }
    if (moduleName === "approvals") {
      return <ApprovalsWidget askConfirmation={askConfirmation} />;
    }
    if (moduleName === "documents") {
      return <DocumentsWidget askConfirmation={askConfirmation} />;
    }
    if (moduleName === "communications") {
      return <CommunicationsWidget askConfirmation={askConfirmation} />;
    }
    if (["audiences","invitations","attendance"].includes(moduleName)) {
      return <ParticipationWidget mode={moduleName} askConfirmation={askConfirmation} />;
    }
    if (["venue_bookings","resource_reservations"].includes(moduleName)) {
      return <CoordinationWidget mode={moduleName} rooms={data.rooms} inventory={data.inventory} askConfirmation={askConfirmation} />;
    }
    if (moduleName === "transportation") return <TransportationWidget askConfirmation={askConfirmation} />;
    if (moduleName === "catering") return <CateringWidget askConfirmation={askConfirmation} />;
    if (["risk_assessments","safeguarding_requirements","medical_referrals"].includes(moduleName)) return <SafetyWidget mode={moduleName} askConfirmation={askConfirmation} />;
    if (moduleName === "contingency") return <ContingencyWidget askConfirmation={askConfirmation} />;
    if (moduleName === "financial_planning") return <FinanceWidget askConfirmation={askConfirmation} />;
    if (moduleName === "event_record") return <EventsWidget askConfirmation={askConfirmation} />;
    if (moduleName === "event_planner") return <EventPlannerWidget />;
    if (moduleName === "student_profile") {
      return <StudentProfileWidget />;
    }
    if (moduleName === "staff_profile") {
      return <StaffProfileWidget />;
    }
    if (config.widget === ModuleStatusWidget && config.moduleName) {
      return <ModuleStatusWidget moduleName={config.moduleName} />;
    }

    return <div className="text-gray-500">Widget not found</div>;
  };

  const handleImportStudents = async (formData, signal) => {
    try {
      const response = await api.importStudents(formData, signal);
      await fetchData();
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleLifecycle = async (action, id) => {
    try {
      await action(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      window.alert(message);
      return { success: false, error: message };
    }
  };

  const handleWithdraw = async (action, id, label) => {
    const confirmed = await askConfirmation({
      title: `Withdraw ${label}?`,
      message: `This ${label} will remain available for review and can be reinstated.`,
      confirmLabel: "Withdraw",
    });
    if (!confirmed) return { success: false, cancelled: true };
    return handleLifecycle(
      (recordId) =>
        action(recordId, {
          reasonCode: "profile_incomplete",
          note: `Withdrawal confirmed for ${label}`,
        }),
      id,
    );
  };

  const permanentDelete = async (action, id, label) => {
    const confirmed = await askConfirmation({
      title: `Permanently delete ${label}?`,
      message: `This withdrawn ${label} and its stored record will be removed. This cannot be undone.`,
      confirmLabel: "Delete permanently",
      destructive: true,
    });
    if (!confirmed) return { success: false, cancelled: true };
    try {
      await action(id, `Permanent deletion confirmed by the user for ${label}`);
      await fetchData();
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      window.alert(message);
      return { success: false, error: message };
    }
  };

  const handleAddStudent = async (formData) => {
    try {
      await api.createStudent(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleEditStudent = async (id, formData) => {
    try {
      await api.updateStudent(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleDeleteStudent = async (id) => {
    return permanentDelete(api.deleteStudent, id, "student");
  };

  const handleImportStaff = async (formData, signal) => {
    try {
      const response = await api.importStaff(formData, signal);
      await fetchData();
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleAddStaff = async (formData) => {
    try {
      await api.createStaff(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleEditStaff = async (id, formData) => {
    try {
      await api.updateStaff(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleDeleteStaff = async (id) => {
    return permanentDelete(api.deleteStaff, id, "staff member");
  };

  const handleImportRooms = async (formData, signal) => {
    try {
      const response = await api.importRooms(formData, signal);
      await fetchData();
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleAddRoom = async (formData) => {
    try {
      await api.createRoom(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleEditRoom = async (id, formData) => {
    try {
      await api.updateRoom(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleDeleteRoom = async (id) => {
    return permanentDelete(api.deleteRoom, id, "room");
  };

  const handleImportInventory = async (formData, signal) => {
    try {
      const response = await api.importInventory(formData, signal);
      await fetchData();
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleAddInventory = async (formData) => {
    try {
      await api.createItem(formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleEditInventory = async (id, formData) => {
    try {
      await api.updateItem(id, formData);
      await fetchData();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  };

  const handleDeleteInventory = async (id) => {
    return permanentDelete(api.deleteItem, id, "inventory item");
  };

  useEffect(() => {
    if (!modulesLoaded) return;
    const availableViews = navItems.map((n) => n.id);
    if (!availableViews.includes(activeView)) {
      setActiveView(availableViews[0] || "overview");
    }
  }, [activeView, modulesLoaded, enabledModules, userData]);

  useEffect(() => {
    sessionStorage.setItem("principaled_active_view", activeView);
  }, [activeView]);

  useEffect(() => {
    const onPopState = (event) =>
      setActiveView(event.state?.principaledView || "overview");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onDirtyState = (event) => setHasUnsavedChanges(Boolean(event.detail));
    window.addEventListener("principaled:dirty-state", onDirtyState);
    return () =>
      window.removeEventListener("principaled:dirty-state", onDirtyState);
  }, []);

  const navigateToView = async (view) => {
    if (view === activeView) return;
    if (hasUnsavedChanges) {
      const leave = await askConfirmation({
        title: "Discard unsaved changes?",
        message:
          "You have an open form. Leaving this screen will discard what you entered.",
        confirmLabel: "Discard and leave",
        destructive: true,
      });
      if (!leave) return;
    }
    window.history.pushState(
      { ...window.history.state, principaledView: view },
      "",
    );
    setActiveView(view);
  };

  const returnToLauncher = async () => {
    if (hasUnsavedChanges) {
      const leave = await askConfirmation({
        title: "Discard unsaved changes?",
        message:
          "Returning to the launcher will discard what you entered in the open form.",
        confirmLabel: "Discard and return",
        destructive: true,
      });
      if (!leave) return;
    }
    window.location.assign("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden">
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-2xl"
          >
            <h2
              id="confirmation-title"
              className="text-xl font-semibold text-white"
            >
              {confirmation.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              {confirmation.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeConfirmation(false)}
                className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeConfirmation(true)}
                className={`rounded px-4 py-2 text-sm font-medium text-white ${
                  confirmation.destructive
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className="w-56 shrink-0 overflow-y-auto bg-gray-900/50 border-r border-gray-800 p-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => void navigateToView(item.id)}
              className={`w-full text-left px-4 py-2 rounded text-sm transition-colors whitespace-nowrap ${
                activeView === item.id
                  ? "bg-timsys-primary text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              activeView === "overview"
                ? window.history.back()
                : navigateToView("overview")
            }
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void returnToLauncher()}
            className="rounded border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Return to Launcher
          </button>
        </div>
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
