import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loginFromHref, parseViewerCount } from '../src/shared/parse';
import {
  findFollowedSection,
  isSideNavExpanded,
  readFollowedChannels,
} from '../src/content/reader';

describe('parseViewerCount', () => {
  it.each([
    ['46.1K', 46_100],
    ['46,1 k', 46_100],
    ['1.2M', 1_200_000],
    ['486', 486],
    ['1,234', 1_234],
    ['1 234', 1_234],
    ['12 345', 12_345],
    ['', 0],
    ['Live', 0],
  ])('« %s » → %d', (text, expected) => {
    expect(parseViewerCount(text)).toBe(expected);
  });
});

describe('loginFromHref', () => {
  it.each([
    ['/Gotaga', 'gotaga'],
    ['/melhssn_?ref=x', 'melhssn_'],
    ['https://www.twitch.tv/payo/videos', 'payo'],
    ['/', null],
    [null, null],
    ['/../evil"x', null],
  ])('%s → %s', (href, expected) => {
    expect(loginFromHref(href)).toBe(expected);
  });
});

describe('lecture de la barre latérale (fixture)', () => {
  beforeEach(() => {
    const html = readFileSync(resolve(__dirname, '../e2e/fixtures/twitch-sidebar.html'), 'utf8');
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
    // jsdom n'exécute pas les <script> insérés via innerHTML : on génère la liste à la main.
    const script = [...document.querySelectorAll('script')].map((s) => s.textContent).join('\n');
    new Function(script)();
  });

  it('trouve la section « Followed Channels » et pas « Live Channels »', () => {
    const section = findFollowedSection();
    expect(section?.getAttribute('aria-label')).toBe('Followed Channels');
    expect(isSideNavExpanded()).toBe(true);
  });

  it('trouve la section même si Twitch est en français', () => {
    document
      .querySelector('[aria-label="Followed Channels"]')!
      .setAttribute('aria-label', 'Chaînes suivies');
    expect(findFollowedSection()?.getAttribute('aria-label')).toBe('Chaînes suivies');
  });

  it('lit les chaînes affichées', () => {
    const channels = readFollowedChannels(findFollowedSection()!);
    expect(channels).toHaveLength(12);
    expect(channels[0]).toEqual({
      login: 'melhssn_',
      displayName: 'melhssn_',
      avatarUrl: 'https://static-cdn.jtvnw.net/fixture/melhssn_.png',
      live: true,
      game: 'VALORANT',
      viewers: 50_700,
      viewersText: '50.7K',
    });
    expect(channels.every((c) => c.live)).toBe(true);
  });

  it('reconnaît les chaînes hors ligne', async () => {
    const section = findFollowedSection()!;
    for (let i = 0; i < 3; i++) {
      section.querySelector<HTMLElement>('[data-a-target="side-nav-show-more-button"]')?.click();
      await new Promise((r) => setTimeout(r, 80));
    }
    const channels = readFollowedChannels(section);
    expect(channels).toHaveLength(33);
    const off = channels.find((c) => c.login === 'katarsisgg')!;
    expect(off).toMatchObject({ live: false, viewers: 0, game: '', displayName: 'katarsisgg' });
  });
});
