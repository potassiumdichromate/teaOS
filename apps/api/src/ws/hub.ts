// Minimal channel pub/sub over ws, backing the WebSocket channels documented
// in docs/API_REFERENCE.md (question:{id}:status, paper:{id}:status, etc.).
// A single-process in-memory hub is sufficient for this prototype; a
// multi-instance production deployment would swap this for Redis pub/sub
// (the connection already exists in workers/queues.ts) without changing callers.
import type { WebSocket } from "ws";

const subscribers = new Map<string, Set<WebSocket>>();

export function registerConnection(ws: WebSocket) {
  const subscribed = new Set<string>();

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string; channel?: string };
      if (msg.type === "subscribe" && msg.channel) {
        subscribed.add(msg.channel);
        if (!subscribers.has(msg.channel)) subscribers.set(msg.channel, new Set());
        subscribers.get(msg.channel)!.add(ws);
      } else if (msg.type === "unsubscribe" && msg.channel) {
        subscribers.get(msg.channel)?.delete(ws);
        subscribed.delete(msg.channel);
      }
    } catch {
      // ignore malformed client frames
    }
  });

  ws.on("close", () => {
    for (const channel of subscribed) subscribers.get(channel)?.delete(ws);
  });
}

export function publish(channel: string, data: unknown) {
  const clients = subscribers.get(channel);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify({ channel, data, at: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}
