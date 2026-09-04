// Tiny event bus used by the browser demo mode in place of Tauri events.
type Handler = (payload: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

export function demoListen(event: string, handler: Handler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}

export function demoEmit(event: string, payload: unknown) {
  handlers.get(event)?.forEach((h) => h(payload));
}
