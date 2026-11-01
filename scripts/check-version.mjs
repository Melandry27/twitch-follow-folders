// Vérifie que le tag git (ex. v0.2.0) correspond à la version de package.json → manifest.json.
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
if (tag !== `v${version}`) {
  console.error(`Le tag « ${tag} » ne correspond pas à la version de package.json (v${version}).`);
  process.exit(1);
}
console.log(`OK : ${tag}`);
