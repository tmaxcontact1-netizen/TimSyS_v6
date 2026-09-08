const transitions = Object.freeze({
  study: Object.freeze({
    draft: ["active", "archived"],
    active: ["draft", "locked", "archived"],
    locked: ["active", "archived"],
    archived: ["draft"],
  }),
  evidence: Object.freeze({
    active: ["withdrawn", "superseded"],
    withdrawn: ["active"],
    superseded: ["active"],
  }),
  finding: Object.freeze({
    draft: ["confirmed", "withdrawn"],
    confirmed: ["draft", "withdrawn"],
    withdrawn: ["draft"],
  }),
});
export type LifecycleKind = keyof typeof transitions;
export function canTransition(
  kind: LifecycleKind,
  current: string,
  target: string,
) {
  const policy = transitions[kind] as Readonly<
    Record<string, readonly string[]>
  >;
  return policy[current]?.includes(target) === true;
}
export function transitionNeedsReason(
  kind: LifecycleKind,
  current: string,
  target: string,
) {
  if (kind === "study") return target === "archived" || current === "locked";
  if (kind === "evidence") return target !== "active";
  return target === "withdrawn";
}
