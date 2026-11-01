import { setAllCollapsed } from '../shared/model';
import { fromExportJson, loadStore, saveStore, toExportJson } from '../shared/storage';
import type { Settings, Store } from '../shared/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const toggles: (keyof Settings)[] = ['enabled', 'autoLoadAll', 'showOfflineInFolders'];

let store: Store;

function message(text: string, kind: 'ok' | 'error' | '' = ''): void {
  const el = $('message');
  el.textContent = text;
  el.className = kind;
}

function refresh(): void {
  for (const key of toggles) $<HTMLInputElement>(key).checked = store.settings[key];
  const channels = store.folders.reduce((n, f) => n + f.channels.length, 0);
  $('stats').textContent =
    store.folders.length === 0
      ? 'Aucun dossier pour le moment. Créez-en un avec « + » dans la barre latérale de Twitch.'
      : `${store.folders.length} dossier(s) · ${channels} chaîne(s) rangée(s)`;
}

async function update(next: Store): Promise<void> {
  store = next;
  await saveStore(store);
  refresh();
}

async function main(): Promise<void> {
  $('version').textContent = `v${chrome.runtime.getManifest().version}`;
  store = await loadStore();
  refresh();

  for (const key of toggles) {
    $<HTMLInputElement>(key).addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      void update({ ...store, settings: { ...store.settings, [key]: checked } });
    });
  }

  $('collapse-all').addEventListener('click', () => void update(setAllCollapsed(store, true)));
  $('expand-all').addEventListener('click', () => void update(setAllCollapsed(store, false)));

  $('export').addEventListener('click', () => {
    const blob = new Blob([toExportJson(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `followfolders-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('Sauvegarde exportée.', 'ok');
  });

  // Dans la petite popup, la fenêtre de choix de fichier ferme la popup :
  // l'import se fait donc dans un onglet (même page, en pleine largeur).
  const inTab = new URLSearchParams(location.search).has('tab');
  if (inTab) document.body.classList.add('in-tab');
  const fileInput = $<HTMLInputElement>('import-file');
  $('import').addEventListener('click', () => {
    if (inTab) fileInput.click();
    else void chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/index.html?tab=1') });
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const imported = fromExportJson(await file.text());
      await update(imported);
      message(`Import réussi : ${imported.folders.length} dossier(s).`, 'ok');
    } catch (err) {
      message(err instanceof Error ? err.message : String(err), 'error');
    }
  });
}

void main();
