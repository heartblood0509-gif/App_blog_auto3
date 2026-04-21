const STORAGE_KEY = "blogpick-gemini-api-key";

export function getStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setStoredApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function removeStoredApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}
