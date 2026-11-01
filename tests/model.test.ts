import { describe, expect, it } from 'vitest';
import {
  addFolder,
  buildView,
  createEmptyStore,
  deleteFolder,
  folderOf,
  moveChannel,
  moveFolder,
  moveFolderBy,
  renameFolder,
  setAllCollapsed,
  toggleFolder,
  updateCache,
} from '../src/shared/model';
import type { LiveChannel, Store } from '../src/shared/types';

const live = (login: string, viewers: number, game = 'VALORANT'): LiveChannel => ({
  login,
  displayName: login.toUpperCase(),
  avatarUrl: `https://static-cdn.jtvnw.net/${login}.png`,
  live: viewers > 0,
  game: viewers > 0 ? game : '',
  viewers,
  viewersText: String(viewers),
});

function storeWithFolders(): Store {
  let s = createEmptyStore();
  s = addFolder(s, 'FPS', 'a');
  s = addFolder(s, 'MMO', 'b');
  s = addFolder(s, 'Potes', 'c');
  return s;
}

describe('dossiers', () => {
  it('crée, renomme et nettoie le nom', () => {
    let s = addFolder(createEmptyStore(), '   Mes   streamers  ', 'x');
    expect(s.folders[0]).toEqual({
      id: 'x',
      name: 'Mes streamers',
      collapsed: false,
      channels: [],
    });
    s = renameFolder(s, 'x', '   ');
    expect(s.folders[0]!.name).toBe('Mes streamers'); // un nom vide garde l'ancien
    s = renameFolder(s, 'x', 'A'.repeat(100));
    expect(s.folders[0]!.name).toHaveLength(40);
  });

  it('ouvre / ferme un dossier', () => {
    let s = storeWithFolders();
    s = toggleFolder(s, 'b');
    expect(s.folders.map((f) => f.collapsed)).toEqual([false, true, false]);
    s = setAllCollapsed(s, true);
    expect(s.folders.every((f) => f.collapsed)).toBe(true);
    expect(s.unsortedCollapsed).toBe(true);
  });

  it('réordonne les dossiers', () => {
    const s = storeWithFolders();
    expect(moveFolder(s, 'c', 0).folders.map((f) => f.id)).toEqual(['c', 'a', 'b']);
    expect(moveFolder(s, 'a', 3).folders.map((f) => f.id)).toEqual(['b', 'c', 'a']);
    expect(moveFolder(s, 'a', 2).folders.map((f) => f.id)).toEqual(['b', 'a', 'c']);
    expect(moveFolderBy(s, 'b', -1).folders.map((f) => f.id)).toEqual(['b', 'a', 'c']);
    expect(moveFolderBy(s, 'b', 1).folders.map((f) => f.id)).toEqual(['a', 'c', 'b']);
    expect(moveFolderBy(s, 'a', -1)).toBe(s); // déjà en haut
  });

  it('supprimer un dossier renvoie ses chaînes dans « Non classées »', () => {
    let s = moveChannel(storeWithFolders(), 'gotaga', 'a');
    s = deleteFolder(s, 'a');
    const view = buildView(s, [live('gotaga', 100)]);
    expect(view.unsorted.map((c) => c.login)).toEqual(['gotaga']);
  });
});

describe('chaînes', () => {
  it("une chaîne n'est que dans un seul dossier", () => {
    let s = moveChannel(storeWithFolders(), 'Gotaga', 'a');
    expect(folderOf(s, 'gotaga')?.id).toBe('a');
    s = moveChannel(s, 'gotaga', 'b');
    expect(s.folders.find((f) => f.id === 'a')!.channels).toEqual([]);
    expect(folderOf(s, 'gotaga')?.id).toBe('b');
    s = moveChannel(s, 'gotaga', null);
    expect(folderOf(s, 'gotaga')).toBeUndefined();
  });

  it('ignore un dossier inexistant', () => {
    const s = storeWithFolders();
    expect(moveChannel(s, 'gotaga', 'nope')).toBe(s);
  });

  it('met en cache nom et avatar, sans réécrire inutilement', () => {
    const s0 = createEmptyStore();
    const s1 = updateCache(s0, [live('payo', 10)], 1_000);
    expect(s1.channels.payo).toMatchObject({ displayName: 'PAYO', lastSeen: 1_000 });
    expect(updateCache(s1, [live('payo', 99)], 2_000)).toBe(s1); // rien de nouveau
    expect(updateCache(s1, [live('payo', 99)], 1_000 + 3_600_001)).not.toBe(s1); // une heure plus tard
  });
});

describe('vue affichée', () => {
  const list = [live('a', 50), live('b', 5000), live('c', 0), live('d', 300), live('e', 0)];

  it('trie live par spectateurs puis hors ligne par nom', () => {
    let s = storeWithFolders();
    for (const login of ['a', 'b', 'c', 'zz']) s = moveChannel(s, login, 'a');
    const v = buildView(s, list);
    expect(v.folders[0]!.channels.map((c) => c.login)).toEqual(['b', 'a', 'c', 'zz']);
    expect(v.folders[0]!.liveCount).toBe(2);
    // « zz » n'est pas dans la liste Twitch : affichée depuis le cache, marquée inconnue
    expect(v.folders[0]!.channels[3]).toMatchObject({ login: 'zz', known: false, live: false });
  });

  it('« Non classées » masque les hors ligne par défaut', () => {
    const s = moveChannel(storeWithFolders(), 'a', 'a');
    const v = buildView(s, list);
    expect(v.unsorted.map((c) => c.login)).toEqual(['b', 'd']);
    expect(v.unsortedHiddenOfflineCount).toBe(2);
    expect(v.unsortedLiveCount).toBe(2);

    const s2 = { ...s, settings: { ...s.settings, showOfflineInUnsorted: true } };
    expect(buildView(s2, list).unsorted.map((c) => c.login)).toEqual(['b', 'd', 'c', 'e']);
  });

  it('option : masquer les hors ligne dans les dossiers', () => {
    let s = moveChannel(storeWithFolders(), 'c', 'b');
    s = moveChannel(s, 'd', 'b');
    s = { ...s, settings: { ...s.settings, showOfflineInFolders: false } };
    const fv = buildView(s, list).folders[1]!;
    expect(fv.channels.map((c) => c.login)).toEqual(['d']);
    expect(fv.hiddenOfflineCount).toBe(1);
  });
});
