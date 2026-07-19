// Offline queue: stores pending writes in localStorage, auto-syncs when online.
// Minimal, dependency-free. Each queue item is a Supabase insert descriptor.

export type QueuedOp = {
  id: string;
  table: string;
  row: Record<string, unknown>;
  ts: number;
};

const KEY = 'suryasetu_queue';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function loadQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'ts'>): QueuedOp {
  const item: QueuedOp = { ...op, id: crypto.randomUUID(), ts: Date.now() };
  const q = loadQueue();
  q.push(item);
  localStorage.setItem(KEY, JSON.stringify(q));
  return item;
}

export function removeFromQueue(id: string) {
  const q = loadQueue().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(q));
}

export async function flushQueue(insertFn: (table: string, row: Record<string, unknown>) => Promise<boolean>) {
  const q = loadQueue();
  for (const item of q) {
    const ok = await insertFn(item.table, item.row);
    if (ok) removeFromQueue(item.id);
    else break; // stop on first failure, retry later
  }
}
