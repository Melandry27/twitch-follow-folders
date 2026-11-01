// Crée release/follow-folders-vX.Y.Z.zip à partir de dist/ (à envoyer au Chrome Web Store ou en GitHub Release).
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { ZipArchive } from 'archiver';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!existsSync('dist/manifest.json')) {
  console.error('dist/ est vide : lancez « npm run build » d’abord.');
  process.exit(1);
}
mkdirSync('release', { recursive: true });
const file = `release/follow-folders-v${version}.zip`;
const output = createWriteStream(file);
const archive = new ZipArchive({ zlib: { level: 9 } });
archive.pipe(output);
archive.directory('dist/', false);
await archive.finalize();
output.on('close', () => console.log(`${file} (${archive.pointer()} octets)`));
