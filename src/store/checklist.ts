import { useCallback, useEffect, useState } from 'react';

const KEY = 'kabunavi.checklist.v1';

type Store = Record<string, string[]>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

const listeners = new Set<(v: Store) => void>();
let current = read();

function write(next: Store) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l(next));
}

/** 銘柄ごとの「買う前チェックリスト」の状態 */
export function useChecklist(code: string) {
  const [store, setStore] = useState(current);
  useEffect(() => {
    listeners.add(setStore);
    return () => {
      listeners.delete(setStore);
    };
  }, []);

  const checked = store[code] ?? [];
  const toggle = useCallback(
    (id: string) => {
      const list = current[code] ?? [];
      write({ ...current, [code]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
    },
    [code]
  );
  const reset = useCallback(() => write({ ...current, [code]: [] }), [code]);

  return { checked, toggle, reset };
}
