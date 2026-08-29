import { useCallback, useEffect, useState } from 'react';

const KEY = 'kabunavi.favorites.v1';

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(v: string[]) => void>();
let current = read();

function write(next: string[]) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l(next));
}

export function useFavorites() {
  const [codes, setCodes] = useState(current);
  useEffect(() => {
    listeners.add(setCodes);
    return () => {
      listeners.delete(setCodes);
    };
  }, []);

  const toggle = useCallback((code: string) => {
    write(current.includes(code) ? current.filter((c) => c !== code) : [...current, code]);
  }, []);

  const has = useCallback((code: string) => codes.includes(code), [codes]);

  return { codes, toggle, has };
}
