import type { ActivityVisibility } from "@/generated/prisma/client";

export const importerVisible: ActivityVisibility[] = ["SHARED", "IMPORTER_ONLY"];
export const dispatcherVisible: ActivityVisibility[] = ["SHARED", "DISPATCHER_ONLY", "IMPORTER_ONLY"];

export function canImporterReceive(visibility: ActivityVisibility) { return importerVisible.includes(visibility); }
export function canDispatcherReceive(visibility: ActivityVisibility) { return dispatcherVisible.includes(visibility); }
export function canAccessActivityCompany(companyIds: readonly string[], companyId: string) { return companyIds.includes(companyId); }
