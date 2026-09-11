import React from "react";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const eventName = "timsys:action-feedback";

function wording(method, phase) {
  if (phase === "working") return method === "DELETE" ? "Deleting…" : "Saving…";
  if (phase === "error") return "The action did not complete. Review the message on this page and try again.";
  if (method === "DELETE") return "Deleted successfully.";
  if (method === "PATCH" || method === "PUT") return "Changes saved.";
  return "Action completed successfully.";
}

export function reportActionFeedback(detail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function ActionFeedbackHost() {
  const [feedback, setFeedback] = React.useState(null);
  React.useEffect(() => {
    const receive = (event) => {
      const detail = event.detail || {};
      setFeedback({ ...detail, message: detail.message || wording(detail.method, detail.phase) });
    };
    window.addEventListener(eventName, receive);
    const original = window.fetch.bind(window);
    const wrapped = async (input, options = {}) => {
      const method = String(options.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (!MUTATIONS.has(method) || options.actionFeedback === false) return original(input, options);
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      reportActionFeedback({ id, method, phase: "working" });
      try {
        const response = await original(input, options);
        reportActionFeedback({ id, method, phase: response.ok ? "success" : "error" });
        return response;
      } catch (error) {
        reportActionFeedback({ id, method, phase: "error" });
        throw error;
      }
    };
    window.fetch = wrapped;
    return () => {
      window.removeEventListener(eventName, receive);
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, []);
  React.useEffect(() => {
    if (!feedback || feedback.phase === "working") return undefined;
    const timer = window.setTimeout(() => setFeedback(null), feedback.phase === "error" ? 8000 : 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  if (!feedback) return null;
  const colour = feedback.phase === "error" ? "#ffb5ba" : feedback.phase === "success" ? "#a5e9c0" : "#dce5ff";
  const border = feedback.phase === "error" ? "#71303a" : feedback.phase === "success" ? "#28543d" : "#3a5088";
  const background = feedback.phase === "error" ? "#35181d" : feedback.phase === "success" ? "#122b20" : "#17213d";
  return <div role={feedback.phase === "error" ? "alert" : "status"} aria-live="polite" aria-atomic="true" style={{ position:"fixed",right:24,bottom:24,zIndex:10000,maxWidth:440,padding:"12px 42px 12px 14px",border:`1px solid ${border}`,borderRadius:10,boxShadow:"0 16px 42px rgb(0 0 0 / 38%)",background,color:colour,font:"600 14px/1.4 Inter, Segoe UI, sans-serif" }}>
    {feedback.message}
    {feedback.phase !== "working" && <button type="button" aria-label="Dismiss confirmation" onClick={() => setFeedback(null)} style={{position:"absolute",right:9,top:7,border:0,background:"transparent",color:"inherit",fontSize:20,cursor:"pointer"}}>×</button>}
  </div>;
}
