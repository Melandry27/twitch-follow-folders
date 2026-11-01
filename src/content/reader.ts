import { loginFromHref, parseViewerCount } from '../shared/parse';
import type { LiveChannel } from '../shared/types';
import { SEL } from './selectors';

/** Trouve la section « Followed Channels » de la barre latérale, quelle que soit la langue. */
export function findFollowedSection(root: ParentNode = document): HTMLElement | null {
  const nav = root.querySelector(SEL.sideNav);
  if (!nav) return null;
  for (const section of nav.querySelectorAll<HTMLElement>(SEL.section)) {
    if (section.querySelector(SEL.followedHeader) || section.querySelector(SEL.followedCard)) {
      return section;
    }
  }
  return null;
}

export function isSideNavExpanded(root: ParentNode = document): boolean {
  const nav = root.querySelector(SEL.sideNav);
  return !!nav && nav.classList.contains(SEL.sideNavExpandedClass);
}

/** Lit toutes les chaînes actuellement présentes dans la section « Followed Channels ». */
export function readFollowedChannels(section: ParentNode): LiveChannel[] {
  const result: LiveChannel[] = [];
  const seen = new Set<string>();
  for (const card of section.querySelectorAll<HTMLAnchorElement>(SEL.followedCard)) {
    const channel = readCard(card);
    if (channel && !seen.has(channel.login)) {
      seen.add(channel.login);
      result.push(channel);
    }
  }
  return result;
}

export function readCard(card: HTMLAnchorElement): LiveChannel | null {
  const login = loginFromHref(card.getAttribute('href'));
  if (!login) return null;

  const titleEl = card.querySelector(SEL.cardTitle);
  const metadata = card.querySelector(SEL.cardMetadata);
  const displayName =
    titleEl?.getAttribute('title')?.trim() ||
    titleEl?.textContent?.trim() ||
    metadata?.querySelector('p')?.textContent?.trim() ||
    login;

  const offline = card.classList.contains(SEL.offlineCardClass);
  const status = card.querySelector(SEL.cardLiveStatus);
  const live = !offline && !!status?.querySelector(SEL.liveIndicator);

  // Le bloc statut contient par ex. « Live », « 46.1K », « 46.1K viewers » : on prend le premier nombre seul.
  let viewersText = '';
  if (live && status) {
    for (const el of status.querySelectorAll('p, span')) {
      const text = el.textContent?.trim() ?? '';
      if (/^\d[\d\s.,\u00a0\u202f]*[kKmM]?$/.test(text)) {
        viewersText = text;
        break;
      }
    }
  }

  const game = live ? (card.querySelector(SEL.cardGame)?.textContent?.trim() ?? '') : '';
  const img = card.querySelector<HTMLImageElement>(SEL.avatarImg);

  return {
    login,
    displayName,
    avatarUrl: img?.getAttribute('src') ?? '',
    live,
    game,
    viewers: live ? parseViewerCount(viewersText) : 0,
    viewersText,
  };
}

/** Clé qui change uniquement si quelque chose d'affiché change (évite les re-rendus inutiles). */
export function channelsSignature(list: LiveChannel[]): string {
  return list
    .map(
      (c) =>
        `${c.login}|${c.live ? 1 : 0}|${c.viewersText}|${c.game}|${c.displayName}|${c.avatarUrl}`,
    )
    .join('\n');
}
