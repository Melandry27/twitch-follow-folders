import { createEmptyStore, DEFAULT_SETTINGS } from './model';
import { SCHEMA_VERSION, type CachedChannel, type Folder, type Store } from './types';

/** Clé unique dans chrome.storage.local. */
export const STORAGE_KEY = 'followFolders';

// ───────────────────────── Validation / migration ─────────────────────────

/**
 * Transforme n'importe quelle valeur (stockage, fichier importé…) en Store valide.
 * Lance une erreur si la donnée est inutilisable. Les champs manquants prennent leur valeur par défaut.
 */
export function normalizeStore(raw: unknown): Store {
  if (!isObject(raw)) throw new Error('Données invalides : un objet est attendu.');
  const migrated = migrate(raw);
  const base = createEmptyStore();

  const foldersRaw = Array.isArray(migrated.folders) ? migrated.folders : [];
  const seenIds = new Set<string>();
  const seenChannels = new Set<string>();
  const folders: Folder[] = [];
  for (const f of foldersRaw) {
    if (!isObject(f) || typeof f.id !== 'string' || seenIds.has(f.id)) continue;
    seenIds.add(f.id);
    const channels = (Array.isArray(f.channels) ? f.channels : [])
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
      .map((c) => c.toLowerCase())
      // une chaîne ne peut être que dans un seul dossier
      .filter((c) => !seenChannels.has(c) && seenChannels.add(c));
    folders.push({
      id: f.id,
      name: typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 40) : 'Dossier',
      collapsed: f.collapsed === true,
      channels,
    });
  }

  const channels: Record<string, CachedChannel> = {};
  if (isObject(migrated.channels)) {
    for (const [login, c] of Object.entries(migrated.channels)) {
      if (!isObject(c)) continue;
      const key = login.toLowerCase();
      channels[key] = {
        login: key,
        displayName: typeof c.displayName === 'string' ? c.displayName : key,
        avatarUrl: typeof c.avatarUrl === 'string' && isSafeAvatar(c.avatarUrl) ? c.avatarUrl : '',
        lastSeen: typeof c.lastSeen === 'number' ? c.lastSeen : 0,
      };
    }
  }

  const s = isObject(migrated.settings) ? migrated.settings : {};
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    folders,
    channels,
    unsortedCollapsed: bool(migrated.unsortedCollapsed, false),
    settings: {
      enabled: bool(s.enabled, DEFAULT_SETTINGS.enabled),
      autoLoadAll: bool(s.autoLoadAll, DEFAULT_SETTINGS.autoLoadAll),
      showOfflineInFolders: bool(s.showOfflineInFolders, DEFAULT_SETTINGS.showOfflineInFolders),
      showOfflineInUnsorted: bool(s.showOfflineInUnsorted, DEFAULT_SETTINGS.showOfflineInUnsorted),
    },
  };
}

/**
 * Migrations successives d'une version du format à la suivante.
 * Exemple pour plus tard :  if (version < 2) { data = { ...data, nouveauChamp: ... }; version = 2; }
 */
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Ces données viennent d'une version plus récente de FollowFolders (format ${version}). Mettez l'extension à jour.`,
    );
  }
  return data;
}

/** Les avatars viennent uniquement du CDN de Twitch. */
function isSafeAvatar(url: string): boolean {
  return /^https:\/\/static-cdn\.jtvnw\.net\//.test(url);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ───────────────────────── chrome.storage.local ─────────────────────────

export async function loadStore(): Promise<Store> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (raw === undefined) return createEmptyStore();
  try {
    return normalizeStore(raw);
  } catch (err) {
    console.warn('[FollowFolders] données illisibles, on repart de zéro', err);
    return createEmptyStore();
  }
}

export async function saveStore(store: Store): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

/** Appelle `listener` quand les données changent (ex. depuis la popup ou un autre onglet). */
export function onStoreChanged(listener: (store: Store) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    const next = changes[STORAGE_KEY]?.newValue;
    try {
      listener(next === undefined ? createEmptyStore() : normalizeStore(next));
    } catch (err) {
      console.warn('[FollowFolders]', err);
    }
  });
}

// ───────────────────────── Export / import JSON ─────────────────────────

export interface ExportFile {
  app: 'follow-folders';
  exportedAt: string;
  data: Store;
}

export function toExportJson(store: Store): string {
  const file: ExportFile = {
    app: 'follow-folders',
    exportedAt: new Date().toISOString(),
    data: store,
  };
  return JSON.stringify(file, null, 2);
}

export function fromExportJson(json: string): Store {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (!isObject(parsed) || parsed.app !== 'follow-folders' || !('data' in parsed)) {
    throw new Error("Ce fichier n'est pas une sauvegarde FollowFolders.");
  }
  return normalizeStore(parsed.data);
}
