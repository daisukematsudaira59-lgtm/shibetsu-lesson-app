import { useEffect, useState } from 'react';
import { provider } from '../data';
import type { Stock } from '../types/stock';

let cached: Stock[] | null = null;
let inflight: Promise<Stock[]> | null = null;

export function useAllStocks() {
  const [stocks, setStocks] = useState<Stock[] | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    if (!inflight) inflight = provider.listAll();
    let alive = true;
    inflight
      .then((list) => {
        cached = list;
        if (alive) setStocks(list);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'データを取得できませんでした'));
    return () => {
      alive = false;
    };
  }, []);

  return { stocks, loading: stocks === null && !error, error };
}

export function useStock(code: string) {
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    provider.getStock(code).then((s) => {
      if (!alive) return;
      setStock(s);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [code]);
  return { stock, loading };
}
