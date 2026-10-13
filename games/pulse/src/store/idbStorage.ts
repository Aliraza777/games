import { del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/**
 * IndexedDB-backed storage for zustand/persist. Every call swallows errors
 * (private windows, blocked storage) so the app still boots — it just won't remember.
 */
export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      return (await get<string>(name)) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(name, value) {
    try {
      await set(name, value);
    } catch {
      /* storage unavailable */
    }
  },
  async removeItem(name) {
    try {
      await del(name);
    } catch {
      /* storage unavailable */
    }
  },
};
