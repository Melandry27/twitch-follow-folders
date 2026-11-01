import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const HERE = import.meta.dirname;
const DIST = resolve(HERE, '..', 'dist');
const FIXTURE = readFileSync(resolve(HERE, 'fixtures', 'twitch-sidebar.html'), 'utf8');

/** Identifiant d'une extension non empaquetée : dérivé du chemin de son dossier. */
function extensionIdFor(path: string): string {
  const hex = createHash('sha256').update(path).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

/** Petit PNG uni pour simuler les avatars du CDN Twitch, sans réseau. */
function solidPng(r: number, g: number, b: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const size = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const test = base.extend<{ context: BrowserContext; page: Page; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ff-')), {
      channel: 'chromium',
      headless: true,
      viewport: { width: 900, height: 1100 },
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    // twitch.tv et son CDN sont simulés : aucun accès réseau réel.
    await context.route('https://www.twitch.tv/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: FIXTURE }),
    );
    await context.route('https://static-cdn.jtvnw.net/**', (route) => {
      const login = route.request().url().split('/').pop() ?? '';
      const h = createHash('md5').update(login).digest();
      route.fulfill({ contentType: 'image/png', body: solidPng(h[0]!, h[1]!, h[2]!) });
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    await use(page);
  },
  // eslint-disable-next-line no-empty-pattern
  extensionId: async ({}, use) => use(extensionIdFor(DIST)),
});

const root = (page: Page) => page.locator('#ff-root');
const folder = (page: Page, name: string) =>
  root(page).locator('.ff-folder', { has: page.locator('.ff-folder-name', { hasText: name }) });

async function openTwitch(page: Page) {
  await page.goto('https://www.twitch.tv/');
  await expect(root(page)).toBeVisible();
}

async function createFolder(page: Page, name: string) {
  await root(page).locator('[data-action="new-folder"]').click();
  const input = root(page).locator('.ff-rename-input');
  await expect(input).toBeFocused();
  await input.fill(name);
  await input.press('Enter');
  await expect(folder(page, name)).toBeVisible();
}

test('remplace « Followed Channels » et garde les autres sections', async ({ page }) => {
  await openTwitch(page);
  await expect(page.locator('[aria-label="Followed Channels"]')).toBeHidden();
  await expect(page.locator('[aria-label="Live Channels"]')).toBeVisible();
  await expect(page.locator('[aria-label="Recommended Categories"]')).toBeAttached();
  // notre bloc est juste au-dessus de « Live Channels »
  const order = await page.evaluate(() => {
    const ff = document.getElementById('ff-root')!;
    return ff.nextElementSibling?.nextElementSibling?.getAttribute('aria-label');
  });
  expect(order).toBe('Live Channels');
});

test('charge toute la liste (Show More automatique)', async ({ page }) => {
  await openTwitch(page);
  const unsorted = root(page).locator('.ff-unsorted');
  // 14 chaînes live dans la fixture, dont 2 cachées derrière « Show More »
  await expect(unsorted.locator('.ff-card')).toHaveCount(14);
  await expect(unsorted.locator('.ff-toggle-offline')).toHaveText('Afficher 19 hors ligne');
  await unsorted.locator('.ff-toggle-offline').click();
  await expect(unsorted.locator('.ff-card')).toHaveCount(33);
});

test('créer un dossier, ranger une chaîne, ouvrir / fermer', async ({ page }) => {
  await openTwitch(page);
  await createFolder(page, 'VALORANT');

  // ranger via le menu ⋯
  const card = root(page).locator('.ff-card-wrap', {
    has: page.locator('.ff-card[data-login="gotaga"]'),
  });
  await card.hover();
  await card.locator('.ff-card-more').click();
  await root(page).locator('.ff-menu-item', { hasText: 'VALORANT' }).click();

  const valo = folder(page, 'VALORANT');
  await expect(valo.locator('.ff-card[data-login="gotaga"]')).toBeVisible();
  await expect(valo.locator('.ff-badge')).toHaveText('1');
  await expect(root(page).locator('.ff-unsorted .ff-card[data-login="gotaga"]')).toHaveCount(0);

  // fermer le dossier
  await valo.locator('.ff-folder-header').click();
  await expect(valo).toHaveClass(/ff-collapsed/);
  await expect(valo.locator('.ff-folder-icon')).toHaveText('📁');
  await expect(valo.locator('.ff-card[data-login="gotaga"]')).toBeHidden();

  // l'état est conservé après rechargement (chrome.storage.local)
  await page.waitForTimeout(400);
  await page.reload();
  await expect(folder(page, 'VALORANT')).toHaveClass(/ff-collapsed/);
  await folder(page, 'VALORANT').locator('.ff-folder-header').click();
  await expect(folder(page, 'VALORANT').locator('.ff-folder-icon')).toHaveText('📂');
  await expect(folder(page, 'VALORANT').locator('.ff-card[data-login="gotaga"]')).toBeVisible();
});

test('glisser-déposer une chaîne et réordonner les dossiers', async ({ page }) => {
  await openTwitch(page);
  await createFolder(page, 'MMO');
  await createFolder(page, 'LoL');

  await root(page)
    .locator('.ff-card-wrap', { has: page.locator('.ff-card[data-login="payo"]') })
    .dragTo(folder(page, 'MMO').locator('.ff-folder-header'));
  await expect(folder(page, 'MMO').locator('.ff-card[data-login="payo"]')).toBeVisible();

  // déposer « LoL » sur le haut de « MMO » → LoL passe en premier
  const target = folder(page, 'MMO').locator('.ff-folder-header');
  await folder(page, 'LoL')
    .locator('.ff-folder-header')
    .dragTo(target, { targetPosition: { x: 40, y: 3 } });
  await expect(root(page).locator('.ff-folder:not(.ff-unsorted) .ff-folder-name')).toHaveText([
    'LoL',
    'MMO',
  ]);
});

test('renommer et supprimer un dossier', async ({ page }) => {
  await openTwitch(page);
  await createFolder(page, 'Temp');
  const temp = folder(page, 'Temp');
  await temp.locator('.ff-folder-header').hover();
  await temp.locator('.ff-more').click();
  await root(page).locator('[data-action="rename"]').click();
  await root(page).locator('.ff-rename-input').fill('Potes');
  await root(page).locator('.ff-rename-input').press('Enter');

  const potes = folder(page, 'Potes');
  await potes.locator('.ff-folder-header').hover();
  await potes.locator('.ff-more').click();
  await root(page).locator('[data-action="delete"]').click();
  await root(page).locator('[data-action="delete-confirm"]').click();
  await expect(potes).toHaveCount(0);
});

test('un clic sur une chaîne navigue comme Twitch (sans rechargement)', async ({ page }) => {
  await openTwitch(page);
  await root(page).locator('.ff-card[data-login="savix"]').click();
  await expect(page).toHaveURL('https://www.twitch.tv/savix');
  await expect(page.locator('#page')).toHaveText('Chaîne savix');
});

test('suit les mises à jour de Twitch (spectateurs, passage en live)', async ({ page }) => {
  await openTwitch(page);
  await page.evaluate(() =>
    (
      window as unknown as { __fixture: { setViewers: (l: string, v: string) => void } }
    ).__fixture.setViewers('katarsisgg', '99.9K'),
  );
  const first = root(page).locator('.ff-unsorted .ff-card').first();
  await expect(first).toHaveAttribute('data-login', 'katarsisgg');
  await expect(first.locator('.ff-status')).toHaveText('99.9K');
});

test('barre réduite ou extension désactivée → liste Twitch d’origine', async ({
  page,
  context,
  extensionId,
}) => {
  await openTwitch(page);
  await page.evaluate(() =>
    (
      window as unknown as { __fixture: { collapseSideNav: () => void } }
    ).__fixture.collapseSideNav(),
  );
  await expect(root(page)).toHaveCount(0);
  await expect(page.locator('[aria-label="Followed Channels"]')).toBeVisible();

  await page.reload();
  await expect(root(page)).toBeVisible();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popup.locator('label', { has: popup.locator('#enabled') }).click();
  await expect(root(page)).toHaveCount(0);
  await expect(page.locator('[aria-label="Followed Channels"]')).toBeVisible();

  await popup.locator('label', { has: popup.locator('#enabled') }).click();
  await expect(root(page)).toBeVisible();
});

test('capture d’écran de démonstration', async ({ page }) => {
  await openTwitch(page);
  await createFolder(page, 'FPS');
  await createFolder(page, 'MMO');
  await createFolder(page, 'Potes');
  const move = async (login: string, name: string) => {
    const card = root(page).locator('.ff-card-wrap', {
      has: page.locator(`.ff-card[data-login="${login}"]`),
    });
    await card.dragTo(folder(page, name).locator('.ff-folder-header'));
  };
  await move('melhssn_', 'FPS');
  await move('loupiote3', 'FPS');
  await move('payo', 'MMO');
  await move('savix', 'MMO');
  await move('aloonea', 'Potes');
  await folder(page, 'MMO').locator('.ff-folder-header').click();
  await page.mouse.move(600, 600);
  await page
    .locator('[data-a-target="side-nav-bar"]')
    .screenshot({ path: 'test-results/demo-sidebar.png' });
});
