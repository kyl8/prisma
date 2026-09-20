import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "../../data";
import { getImporterNotifications, markImporterNotificationRead } from "../../api/importer";

// The notifications API is shared by both roles; it scopes all reads by session.
export function useWorkspaceNotifications(userId?: string, open = false) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!userId) { setNotifications([]); return; }
    let active = true;
    getImporterNotifications().then((items) => { if (active) { setNotifications(items); setError(""); } })
      .catch(() => { if (active) setError("Não foi possível atualizar as notificações. Tente novamente."); });
    return () => { active = false; };
  }, [userId, open, refreshKey]);
  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("prisma:siscomex-updated", refresh);
    return () => window.removeEventListener("prisma:siscomex-updated", refresh);
  }, []);
  const markRead = useCallback(async (id: string) => {
    try {
      await markImporterNotificationRead(id);
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch { setError("Não foi possível marcar a notificação como lida."); }
  }, []);
  return { notifications, error, markRead, retry: () => setRefreshKey((value) => value + 1) };
}
