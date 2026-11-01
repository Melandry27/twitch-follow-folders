import {
  SCHEMA_VERSION,
  type CachedChannel,
  type ChannelView,
  type Folder,
  type FolderView,
  type LiveChannel,
  type Settings,
  type SidebarView,
  type Store,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  autoLoadAll: true,
  showOfflineInFolders: true,
  showOfflineInUnsorted: false,
};

export function createEmptyStore(): Store {
  return {
    schemaVersion: SCHEMA_VERSION,
    folders: [],
    channels: {},
    unsortedCollapsed: false,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function newId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_NAME_LENGTH = 40;

export function cleanName(name: string, fallback: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || fallback;
}

// ───────────────────────── Dossiers ─────────────────────────

export function addFolder(store: Store, name: string, id: string = newId()): Store {
  const folder: Folder = { id, name: cleanName(name, 'Dossier'), collapsed: false, channels: [] };
  return { ...store, folders: [...store.folders, folder] };
}

export function renameFolder(store: Store, folderId: string, name: string): Store {
  return mapFolder(store, folderId, (f) => ({ ...f, name: cleanName(name, f.name) }));
}

/** Supprime un dossier : ses chaînes retournent dans « Non classées ». */
export function deleteFolder(store: Store, folderId: string): Store {
  return { ...store, folders: store.folders.filter((f) => f.id !== folderId) };
}

export function toggleFolder(store: Store, folderId: string): Store {
  return mapFolder(store, folderId, (f) => ({ ...f, collapsed: !f.collapsed }));
}

export function setAllCollapsed(store: Store, collapsed: boolean): Store {
  return {
    ...store,
    unsortedCollapsed: collapsed,
    folders: store.folders.map((f) => ({ ...f, collapsed })),
  };
}

/** Déplace un dossier à la position `toIndex` (indices dans la liste avant déplacement). */
export function moveFolder(store: Store, folderId: string, toIndex: number): Store {
  const from = store.folders.findIndex((f) => f.id === folderId);
  if (from === -1) return store;
  const folders = [...store.folders];
  const [moved] = folders.splice(from, 1);
  if (!moved) return store;
  const target = Math.max(0, Math.min(folders.length, toIndex > from ? toIndex - 1 : toIndex));
  folders.splice(target, 0, moved);
  return { ...store, folders };
}

export function moveFolderBy(store: Store, folderId: string, delta: number): Store {
  const from = store.folders.findIndex((f) => f.id === folderId);
  if (from === -1) return store;
  const to = from + delta;
  if (to < 0 || to >= store.folders.length) return store;
  return moveFolder(store, folderId, delta > 0 ? to + 1 : to);
}

// ───────────────────────── Chaînes ─────────────────────────

export function folderOf(store: Store, login: string): Folder | undefined {
  return store.folders.find((f) => f.channels.includes(login));
}

/**
 * Range une chaîne dans un dossier (`null` = « Non classées »).
 * Une chaîne n'appartient qu'à un seul dossier : elle est retirée de l'ancien.
 */
export function moveChannel(
  store: Store,
  login: string,
  folderId: string | null,
  index?: number,
): Store {
  const key = login.toLowerCase();
  if (folderId !== null && !store.folders.some((f) => f.id === folderId)) return store;
  const folders = store.folders.map((f) => {
    const without = f.channels.filter((c) => c !== key);
    if (f.id !== folderId)
      return without.length === f.channels.length ? f : { ...f, channels: without };
    const at = index === undefined ? without.length : Math.max(0, Math.min(without.length, index));
    return { ...f, channels: [...without.slice(0, at), key, ...without.slice(at)] };
  });
  return { ...store, folders };
}

/** Met à jour le cache (nom, avatar) avec les chaînes lues dans la barre latérale. */
export function updateCache(store: Store, live: LiveChannel[], now = Date.now()): Store {
  let changed = false;
  const channels: Record<string, CachedChannel> = { ...store.channels };
  for (const ch of live) {
    const prev = channels[ch.login];
    const avatarUrl = ch.avatarUrl || prev?.avatarUrl || '';
    const displayName = ch.displayName || prev?.displayName || ch.login;
    // On n'écrit lastSeen que toutes les heures pour éviter des écritures inutiles.
    const stale = !prev || now - prev.lastSeen > 3_600_000;
    if (!prev || prev.avatarUrl !== avatarUrl || prev.displayName !== displayName || stale) {
      channels[ch.login] = { login: ch.login, displayName, avatarUrl, lastSeen: now };
      changed = true;
    }
  }
  return changed ? { ...store, channels } : store;
}

// ───────────────────────── Vue (ce qui est affiché) ─────────────────────────

/** Tri : live d'abord par spectateurs décroissants, puis hors ligne par ordre alphabétique. */
export function compareChannels(a: ChannelView, b: ChannelView): number {
  if (a.live !== b.live) return a.live ? -1 : 1;
  if (a.live && b.live && a.viewers !== b.viewers) return b.viewers - a.viewers;
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

function viewOf(login: string, liveByLogin: Map<string, LiveChannel>, store: Store): ChannelView {
  const live = liveByLogin.get(login);
  if (live) return { ...live, known: true };
  const cached = store.channels[login];
  return {
    login,
    displayName: cached?.displayName ?? login,
    avatarUrl: cached?.avatarUrl ?? '',
    live: false,
    game: '',
    viewers: 0,
    viewersText: '',
    known: false,
  };
}

export function buildView(store: Store, liveList: LiveChannel[]): SidebarView {
  const liveByLogin = new Map(liveList.map((c) => [c.login, c]));
  const inFolder = new Set<string>();

  const folders: FolderView[] = store.folders.map((folder) => {
    const all = folder.channels.map((login) => {
      inFolder.add(login);
      return viewOf(login, liveByLogin, store);
    });
    all.sort(compareChannels);
    const visible = store.settings.showOfflineInFolders ? all : all.filter((c) => c.live);
    return {
      folder,
      channels: visible,
      liveCount: all.filter((c) => c.live).length,
      hiddenOfflineCount: all.length - visible.length,
    };
  });

  const unsortedAll = liveList
    .filter((c) => !inFolder.has(c.login))
    .map((c) => ({ ...c, known: true }))
    .sort(compareChannels);
  const unsorted = store.settings.showOfflineInUnsorted
    ? unsortedAll
    : unsortedAll.filter((c) => c.live);

  return {
    folders,
    unsorted,
    unsortedLiveCount: unsortedAll.filter((c) => c.live).length,
    unsortedHiddenOfflineCount: unsortedAll.length - unsorted.length,
  };
}

// ───────────────────────── Utilitaires ─────────────────────────

function mapFolder(store: Store, folderId: string, fn: (f: Folder) => Folder): Store {
  return { ...store, folders: store.folders.map((f) => (f.id === folderId ? fn(f) : f)) };
}
