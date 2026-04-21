/**
 * IndexedDB 기반 이미지 저장소
 * localStorage 용량 제한(5~10MB) 없이 블로그 이미지를 저장
 */

import type { BlogImage } from "@/components/project/blog-image-generator";

const DB_NAME = "blogpick-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 히스토리 ID에 연결된 이미지 배열 저장 */
export async function saveImages(historyId: string, images: BlogImage[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(images, historyId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 히스토리 ID로 이미지 배열 조회 */
export async function getImages(historyId: string): Promise<BlogImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(historyId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/** 히스토리 ID로 이미지 삭제 */
export async function deleteImages(historyId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(historyId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
