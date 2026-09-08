import { describe, expect, it } from "vitest";
import {
  canTransition,
  transitionNeedsReason,
} from "../src/domain/lifecycle.js";
describe("research lifecycle policy", () => {
  it("supports deliberate forward, withdrawal and reinstatement paths", () => {
    expect(canTransition("study", "active", "locked")).toBe(true);
    expect(canTransition("finding", "draft", "confirmed")).toBe(true);
    expect(canTransition("finding", "withdrawn", "draft")).toBe(true);
    expect(canTransition("evidence", "withdrawn", "active")).toBe(true);
  });
  it("rejects skips and no-op transitions", () => {
    expect(canTransition("study", "draft", "locked")).toBe(false);
    expect(canTransition("finding", "confirmed", "confirmed")).toBe(false);
    expect(canTransition("evidence", "withdrawn", "superseded")).toBe(false);
  });
  it("requires reasons when context is removed or a lock is broken", () => {
    expect(transitionNeedsReason("evidence", "active", "withdrawn")).toBe(true);
    expect(transitionNeedsReason("finding", "confirmed", "withdrawn")).toBe(
      true,
    );
    expect(transitionNeedsReason("study", "locked", "active")).toBe(true);
    expect(transitionNeedsReason("evidence", "withdrawn", "active")).toBe(
      false,
    );
  });
});
