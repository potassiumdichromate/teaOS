import { useEffect, useState } from "react";

export interface LiveLogEntry {
  type: "audit" | "security";
  id: string;
  action?: string;
  severity?: string;
  category?: string;
  createdAt: string;
}

/** Subscribes to the `admin:live-logs` WS channel (see apps/api/src/ws/hub.ts). */
export function useLiveLogs(max = 30): LiveLogEntry[] {
  const [entries, setEntries] = useState<LiveLogEntry[]>([]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "subscribe", channel: "admin:live-logs" })));
    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data) as { channel: string; data: LiveLogEntry };
        if (msg.channel === "admin:live-logs") {
          setEntries((prev) => [msg.data, ...prev].slice(0, max));
        }
      } catch {
        // ignore malformed frames
      }
    });
    return () => ws.close();
  }, [max]);

  return entries;
}
