import assert from "node:assert/strict";
import test from "node:test";
import { canAccessActivityCompany, canDispatcherReceive, canImporterReceive } from "./activity.policy";

test("importer never receives dispatcher/internal events", () => {
  assert.equal(canImporterReceive("SHARED"), true);
  assert.equal(canImporterReceive("IMPORTER_ONLY"), true);
  assert.equal(canImporterReceive("DISPATCHER_ONLY"), false);
  assert.equal(canImporterReceive("SYSTEM_INTERNAL"), false);
});
test("dispatcher receives common activity but never internal activity", () => {
  assert.equal(canDispatcherReceive("SHARED"), true);
  assert.equal(canDispatcherReceive("DISPATCHER_ONLY"), true);
  assert.equal(canDispatcherReceive("SYSTEM_INTERNAL"), false);
});
test("company access never trusts a manually supplied foreign company id", () => {
  assert.equal(canAccessActivityCompany(["atlas"], "atlas"), true);
  assert.equal(canAccessActivityCompany(["atlas"], "ocean"), false);
});
