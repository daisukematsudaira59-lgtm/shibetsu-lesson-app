import { useCallback, useEffect, useState } from 'react';

const KEY = 'kabunavi.settings.v1';

export interface Settings {
  /** 初心者モード：専門用語を減らし、説明を厚くする */
  beginnerMode: boolean;
  /** 免責事項に同意済みか */
  disclaimerAccepted: boolean;
}

const DEFAULTS: Settings = { beginnerMode: true, disclaimerAccepted: false };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const listeners = new Set<(s: Settings) => void>();
let current = read();

function write(next: Settings) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ストレージが使えない環境では保存しない */
  }
  listeners.forEach((l) => l(next));
}

export function useSettings() {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  const update = useCallback((patch: Partial<Settings>) => write({ ...current, ...patch }), []);
  return [state, update] as const;
}
