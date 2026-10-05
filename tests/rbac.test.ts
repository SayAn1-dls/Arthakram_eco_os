import { test } from "node:test";
import assert from "node:assert/strict";
import { allows, canGrant, type Grant, type Scope } from "../src/lib/rbac-core";
import { ALL_PERMISSIONS, PROTECTED_ROLE_KEYS, SYSTEM_ROLES } from "../src/lib/permissions";

const role = (key: string) => SYSTEM_ROLES.find((r) => r.key === key)!;
const grant = (key: string, scopeType: Grant["scopeType"], scopeId: string | null): Grant => ({
  assignmentId: key + scopeId,
  roleId: key,
  roleKey: key,
  roleName: key,
  scopeType,
  scopeId,
  permissions: new Set(role(key).permissions),
});

const eventA: Scope = { type: "event", id: "evA", organizationId: "org1", collegeId: "col1", clubId: "club1" };
const eventB: Scope = { type: "event", id: "evB", organizationId: "org1", collegeId: "col1", clubId: "club2" };
const eventC: Scope = { type: "event", id: "evC", organizationId: "org2", collegeId: null, clubId: null };

test("event organizer is confined to their event", () => {
  const g = [grant("organizer", "event", "evA")];
  assert.equal(allows(g, "events.edit", eventA), true);
  assert.equal(allows(g, "timers.manage", eventA), true);
  assert.equal(allows(g, "events.edit", eventB), false);
  assert.equal(allows(g, "users.view", { type: "platform" }), false);
  assert.equal(allows(g, "settings.manage", eventA), false);
});

test("club lead grant flows down to every club event", () => {
  const g = [grant("club_lead", "club", "club1")];
  assert.equal(allows(g, "results.publish", eventA), true);
  assert.equal(allows(g, "results.publish", eventB), false);
});

test("judge cannot modify rubrics", () => {
  const g = [grant("judge", "event", "evA")];
  assert.equal(allows(g, "evaluations.submit", eventA), true);
  assert.equal(allows(g, "rubrics.view", eventA), true);
  assert.equal(allows(g, "rubrics.manage", eventA), false);
  assert.equal(allows(g, "events.edit", eventA), false);
});

test("organizer cannot publish results — admin controls publication", () => {
  const g = [grant("organizer", "event", "evA")];
  assert.equal(allows(g, "results.edit", eventA), true);
  assert.equal(allows(g, "results.publish", eventA), false);
});

test("platform admin reaches everything; manage implies sub-actions", () => {
  const g = [grant("admin", "platform", null)];
  for (const p of ALL_PERMISSIONS) assert.equal(allows(g, p, eventC), true, p);
  const custom: Grant = { ...grant("student", "event", "evA"), permissions: new Set(["documents.manage"]) };
  assert.equal(allows([custom], "documents.publish", eventA), true);
});

test("escalation guard: cannot grant what you do not hold", () => {
  const organizer = [grant("organizer", "event", "evA")];
  assert.equal(canGrant(organizer, role("volunteer"), eventA, PROTECTED_ROLE_KEYS).ok, true);
  assert.equal(canGrant(organizer, role("judge"), eventA, PROTECTED_ROLE_KEYS).ok, false); // lacks evaluations.submit
  assert.equal(canGrant(organizer, role("volunteer"), eventB, PROTECTED_ROLE_KEYS).ok, false);
  const admin = [grant("admin", "platform", null)];
  assert.equal(canGrant(admin, role("admin"), { type: "platform" }, PROTECTED_ROLE_KEYS).ok, false);
  const sa = [grant("super_admin", "platform", null)];
  assert.equal(canGrant(sa, role("admin"), { type: "platform" }, PROTECTED_ROLE_KEYS).ok, true);
});
