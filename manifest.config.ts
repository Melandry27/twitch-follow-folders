import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

// La version de l'extension vient de package.json : une seule source de vérité.
export default defineManifest({
  manifest_version: 3,
  name: 'FollowFolders — dossiers pour Twitch',
  short_name: 'FollowFolders',
  description:
    'Rangez vos chaînes Twitch suivies dans des dossiers que vous pouvez ouvrir et fermer.',
  version: pkg.version,
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_title: 'FollowFolders',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
    },
  },
  permissions: ['storage'],
  content_scripts: [
    {
      matches: ['https://www.twitch.tv/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
});
