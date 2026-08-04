import type { SyncQueueItem, UserRole } from "./types";

/**
 * Gli account staff possono modificare il proprio profilo e leggere gli avvisi,
 * ma non devono mai caricare log atleta rimasti nel browser da versioni legacy.
 * Gli elementi esclusi restano nella coda locale: questa funzione non cancella dati.
 */
export function isSyncItemAllowedForRole(
  item: Pick<SyncQueueItem, "entity">,
  role?: UserRole,
) {
  if (role !== "admin" && role !== "coach") return true;
  return item.entity === "profile" || item.entity === "notification_read";
}
