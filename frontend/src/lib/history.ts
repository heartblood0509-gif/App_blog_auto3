export interface HistoryItem {
  id: string;
  type: "blog" | "threads";
  title: string;
  content: string;
  imageCount?: number;
  createdAt: string; // ISO date string
}

const STORAGE_KEY = "blogpick-history";

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

/** 히스토리 추가, 생성된 ID를 반환 */
export function addHistory(item: Omit<HistoryItem, "id" | "createdAt">): string {
  const history = getHistory();
  const id = crypto.randomUUID();
  history.unshift({
    ...item,
    id,
    createdAt: new Date().toISOString(),
  });
  // Keep max 50 items
  if (history.length > 50) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return id;
}

/** 히스토리 항목 업데이트 (imageCount 등) */
export function updateHistory(id: string, updates: Partial<Pick<HistoryItem, "imageCount">>): void {
  const history = getHistory();
  const idx = history.findIndex((item) => item.id === id);
  if (idx === -1) return;
  Object.assign(history[idx], updates);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function deleteHistory(id: string): void {
  const history = getHistory().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
