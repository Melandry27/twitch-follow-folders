import { describe, expect, it } from 'vitest';
import { addFolder, createEmptyStore, moveChannel } from '../src/shared/model';
import { fromExportJson, normalizeStore, toExportJson } from '../src/shared/storage';
import { SCHEMA_VERSION } from '../src/shared/types';

describe('normalizeStore', () => {
  it('complète les champs manquants avec les valeurs par défaut', () => {
    const s = normalizeStore({ folders: [{ id: 'x', name: 'FPS', channels: ['Gotaga'] }] });
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.folders[0]).toEqual({ id: 'x', name: 'FPS', collapsed: false, channels: ['gotaga'] });
    expect(s.settings.enabled).toBe(true);
    expect(s.unsortedCollapsed).toBe(false);
  });

  it('nettoie les données incohérentes', () => {
    const s = normalizeStore({
      folders: [
        { id: 'a', name: '', channels: ['x', 'x', 42, ''] },
        { id: 'a', name: 'doublon' },
        { id: 'b', name: 'B', channels: ['x', 'y'] },
        'pas un dossier',
      ],
      channels: {
        X: { displayName: 'X', avatarUrl: 'javascript:alert(1)', lastSeen: 5 },
      },
    });
    expect(s.folders.map((f) => f.id)).toEqual(['a', 'b']);
    expect(s.folders[0]!.name).toBe('Dossier');
    expect(s.folders[0]!.channels).toEqual(['x']);
    expect(s.folders[1]!.channels).toEqual(['y']); // « x » est déjà dans « a »
    expect(s.channels.x!.avatarUrl).toBe(''); // seules les URL du CDN Twitch sont acceptées
  });

  it('refuse une version plus récente du format', () => {
    expect(() => normalizeStore({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/plus récente/);
  });

  it('refuse une valeur qui n’est pas un objet', () => {
    expect(() => normalizeStore(null)).toThrow();
    expect(() => normalizeStore([])).toThrow();
  });
});

describe('export / import', () => {
  it('fait un aller-retour sans perte', () => {
    let s = addFolder(createEmptyStore(), 'FPS', 'f1');
    s = moveChannel(s, 'gotaga', 'f1');
    expect(fromExportJson(toExportJson(s))).toEqual(s);
  });

  it('refuse un fichier qui n’est pas une sauvegarde FollowFolders', () => {
    expect(() => fromExportJson('pas du json')).toThrow(/JSON/);
    expect(() => fromExportJson('{"folders": []}')).toThrow(/FollowFolders/);
  });
});
