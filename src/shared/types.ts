/** Version actuelle du format enregistré. À incrémenter à chaque changement de structure (+ migration). */
export const SCHEMA_VERSION = 1;

export interface Folder {
  id: string;
  name: string;
  /** true = dossier fermé 📁, false = ouvert 📂 */
  collapsed: boolean;
  /** logins Twitch (minuscules), dans l'ordre manuel */
  channels: string[];
}

/** Infos mémorisées sur une chaîne, pour pouvoir l'afficher même quand elle n'est pas dans la liste Twitch. */
export interface CachedChannel {
  login: string;
  displayName: string;
  avatarUrl: string;
  /** timestamp (ms) de la dernière fois où la chaîne a été vue dans la barre latérale */
  lastSeen: number;
}

export interface Settings {
  /** interrupteur général : false = barre latérale Twitch d'origine */
  enabled: boolean;
  /** cliquer automatiquement sur « Show More » pour charger toutes les chaînes suivies */
  autoLoadAll: boolean;
  /** afficher les chaînes hors ligne à l'intérieur des dossiers */
  showOfflineInFolders: boolean;
  /** afficher les chaînes hors ligne dans « Non classées » */
  showOfflineInUnsorted: boolean;
}

export interface Store {
  schemaVersion: number;
  folders: Folder[];
  channels: Record<string, CachedChannel>;
  /** état ouvert/fermé de la section « Non classées » */
  unsortedCollapsed: boolean;
  settings: Settings;
}

/** Une chaîne telle que lue dans la barre latérale Twitch, à un instant donné. */
export interface LiveChannel {
  login: string;
  displayName: string;
  avatarUrl: string;
  live: boolean;
  game: string;
  /** nombre de spectateurs (0 si hors ligne) */
  viewers: number;
  /** nombre tel qu'affiché par Twitch, ex. « 46.1K » */
  viewersText: string;
}

/** Ce qui est affiché pour une chaîne : live si on la voit, sinon reconstitué depuis le cache. */
export interface ChannelView extends LiveChannel {
  /** false = chaîne absente de la liste Twitch (plus suivie, ou pas encore chargée) */
  known: boolean;
}

export interface FolderView {
  folder: Folder;
  channels: ChannelView[];
  liveCount: number;
  hiddenOfflineCount: number;
}

export interface SidebarView {
  folders: FolderView[];
  unsorted: ChannelView[];
  unsortedLiveCount: number;
  unsortedHiddenOfflineCount: number;
}
