import { t } from '../shared/strings';
import type { ChannelView, FolderView, SidebarView, Store } from '../shared/types';

export const UNSORTED_ID = '__unsorted';

/** État d'interface éphémère (non enregistré). */
export interface UiState {
  menu: { kind: 'folder'; id: string } | { kind: 'channel'; login: string } | null;
  renamingId: string | null;
  confirmDeleteId: string | null;
}

export const initialUi = (): UiState => ({ menu: null, renamingId: null, confirmDeleteId: null });

// ───────────────────────── mini-helper DOM (pas d'innerHTML → pas d'injection) ─────────────────────────

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

// ───────────────────────── Rendu ─────────────────────────

export function renderSidebar(view: SidebarView, store: Store, ui: UiState): DocumentFragment {
  const frag = document.createDocumentFragment();

  frag.append(
    h(
      'div',
      { class: 'ff-header' },
      h('h3', { class: 'ff-title' }, t.sectionTitle),
      h(
        'div',
        { class: 'ff-header-actions' },
        h(
          'button',
          {
            class: 'ff-icon-btn',
            'data-action': 'new-folder',
            title: t.newFolder,
            'aria-label': t.newFolder,
          },
          '+',
        ),
      ),
    ),
  );

  if (view.folders.length === 0) {
    frag.append(
      h('div', { class: 'ff-hint' }, 'Créez un dossier avec « + », puis glissez-y vos chaînes.'),
    );
  }

  view.folders.forEach((fv, index) => {
    frag.append(renderFolder(fv, index, view.folders.length, store, ui));
  });

  frag.append(renderUnsorted(view, store, ui));
  return frag;
}

function renderFolder(
  fv: FolderView,
  index: number,
  total: number,
  store: Store,
  ui: UiState,
): HTMLElement {
  const { folder } = fv;
  const renaming = ui.renamingId === folder.id;
  const menuOpen = ui.menu?.kind === 'folder' && ui.menu.id === folder.id;

  const header = h(
    'div',
    {
      class: 'ff-folder-header',
      role: 'button',
      tabindex: 0,
      'aria-expanded': String(!folder.collapsed),
      'data-action': renaming ? null : 'toggle',
      'data-folder-id': folder.id,
      draggable: renaming ? null : 'true',
      title: folder.name,
    },
    h('span', { class: 'ff-chevron', 'aria-hidden': 'true' }, '▶'),
    h('span', { class: 'ff-folder-icon', 'aria-hidden': 'true' }, folder.collapsed ? '📁' : '📂'),
    renaming
      ? h('input', {
          class: 'ff-rename-input',
          type: 'text',
          value: folder.name,
          maxlength: 40,
          'data-rename-id': folder.id,
          'aria-label': t.newFolderPlaceholder,
          placeholder: t.newFolderPlaceholder,
        })
      : h('span', { class: 'ff-folder-name' }, folder.name),
    !renaming && fv.liveCount > 0
      ? h('span', { class: 'ff-badge', title: t.liveCount(fv.liveCount) }, String(fv.liveCount))
      : null,
    renaming
      ? null
      : h(
          'button',
          {
            class: 'ff-icon-btn ff-more',
            'data-action': 'folder-menu',
            'data-folder-id': folder.id,
            title: t.folderActions,
            'aria-label': t.folderActions,
            'aria-haspopup': 'menu',
            'aria-expanded': String(menuOpen),
          },
          '⋯',
        ),
  );

  const el = h(
    'div',
    {
      class: `ff-folder${folder.collapsed ? ' ff-collapsed' : ''}`,
      'data-folder-id': folder.id,
      'data-drop-folder': folder.id,
    },
    header,
  );

  if (menuOpen) el.append(renderFolderMenu(folder.id, index, total, ui));

  const body = h('div', { class: 'ff-folder-body' });
  if (fv.channels.length === 0) {
    body.append(
      h(
        'div',
        { class: 'ff-empty' },
        fv.hiddenOfflineCount > 0 ? `${fv.hiddenOfflineCount} hors ligne` : t.emptyFolder,
      ),
    );
  }
  for (const ch of fv.channels) body.append(renderChannel(ch, folder.id, store, ui));
  el.append(body);
  return el;
}

function renderFolderMenu(
  folderId: string,
  index: number,
  total: number,
  ui: UiState,
): HTMLElement {
  if (ui.confirmDeleteId === folderId) {
    return h(
      'div',
      { class: 'ff-menu', role: 'dialog' },
      h(
        'div',
        { class: 'ff-confirm' },
        t.confirmDelete,
        h(
          'div',
          { class: 'ff-confirm-actions' },
          h(
            'button',
            { class: 'ff-danger', 'data-action': 'delete-confirm', 'data-folder-id': folderId },
            t.yes,
          ),
          h('button', { 'data-action': 'close-menu' }, t.no),
        ),
      ),
    );
  }
  const item = (action: string, label: string, opts: Attrs = {}) =>
    h(
      'button',
      {
        class: 'ff-menu-item',
        role: 'menuitem',
        'data-action': action,
        'data-folder-id': folderId,
        ...opts,
      },
      label,
    );
  return h(
    'div',
    { class: 'ff-menu', role: 'menu' },
    item('rename', `✏️  ${t.rename}`),
    item('move-up', `↑  ${t.moveUp}`, { disabled: index === 0 }),
    item('move-down', `↓  ${t.moveDown}`, { disabled: index === total - 1 }),
    item('delete', `🗑️  ${t.delete}`, { class: 'ff-menu-item ff-danger' }),
  );
}

function renderUnsorted(view: SidebarView, store: Store, ui: UiState): HTMLElement {
  const collapsed = store.unsortedCollapsed;
  const el = h(
    'div',
    {
      class: `ff-folder ff-unsorted${collapsed ? ' ff-collapsed' : ''}`,
      'data-folder-id': UNSORTED_ID,
      'data-drop-folder': UNSORTED_ID,
    },
    h(
      'div',
      {
        class: 'ff-folder-header',
        role: 'button',
        tabindex: 0,
        'aria-expanded': String(!collapsed),
        'data-action': 'toggle',
        'data-folder-id': UNSORTED_ID,
      },
      h('span', { class: 'ff-chevron', 'aria-hidden': 'true' }, '▶'),
      h('span', { class: 'ff-folder-icon', 'aria-hidden': 'true' }, collapsed ? '📁' : '📂'),
      h('span', { class: 'ff-folder-name' }, t.unsorted),
      view.unsortedLiveCount > 0
        ? h(
            'span',
            { class: 'ff-badge', title: t.liveCount(view.unsortedLiveCount) },
            String(view.unsortedLiveCount),
          )
        : null,
    ),
  );

  const body = h('div', { class: 'ff-folder-body' });
  for (const ch of view.unsorted) body.append(renderChannel(ch, null, store, ui));

  if (view.unsortedHiddenOfflineCount > 0) {
    body.append(
      h(
        'button',
        { class: 'ff-toggle-offline', 'data-action': 'toggle-unsorted-offline' },
        t.showOffline(view.unsortedHiddenOfflineCount),
      ),
    );
  } else if (store.settings.showOfflineInUnsorted && view.unsorted.some((c) => !c.live)) {
    body.append(
      h(
        'button',
        { class: 'ff-toggle-offline', 'data-action': 'toggle-unsorted-offline' },
        t.hideOffline,
      ),
    );
  }
  if (view.unsorted.length === 0 && view.unsortedHiddenOfflineCount === 0) {
    body.append(h('div', { class: 'ff-empty' }, 'Toutes vos chaînes sont rangées 👌'));
  }
  el.append(body);
  return el;
}

function renderChannel(
  ch: ChannelView,
  folderId: string | null,
  store: Store,
  ui: UiState,
): HTMLElement {
  const menuOpen = ui.menu?.kind === 'channel' && ui.menu.login === ch.login;
  const subtitle = ch.live ? ch.game : ch.known ? t.offline : t.notLoaded;

  const avatar = ch.avatarUrl
    ? h('img', { class: 'ff-avatar', src: ch.avatarUrl, alt: '', loading: 'lazy' })
    : h(
        'span',
        { class: 'ff-avatar ff-avatar-placeholder', 'aria-hidden': 'true' },
        ch.displayName.charAt(0).toUpperCase(),
      );

  const card = h(
    'a',
    {
      class: `ff-card${ch.live ? '' : ' ff-offline'}`,
      href: `/${ch.login}`,
      'data-login': ch.login,
      draggable: 'false',
      title: ch.live && ch.game ? `${ch.displayName} — ${ch.game}` : ch.displayName,
    },
    avatar,
    h(
      'div',
      { class: 'ff-meta' },
      h('p', { class: 'ff-name' }, ch.displayName),
      h('p', { class: 'ff-game' }, subtitle),
    ),
    ch.live
      ? h(
          'div',
          { class: 'ff-status' },
          h('span', { class: 'ff-dot', 'aria-hidden': 'true' }),
          h('span', {}, ch.viewersText || 'Live'),
        )
      : null,
  );

  const wrap = h(
    'div',
    { class: 'ff-card-wrap', draggable: 'true', 'data-drag-login': ch.login },
    card,
    h(
      'button',
      {
        class: 'ff-icon-btn ff-card-more',
        'data-action': 'channel-menu',
        'data-login': ch.login,
        title: t.channelActions,
        'aria-label': `${t.channelActions} ${ch.displayName}`,
        'aria-haspopup': 'menu',
        'aria-expanded': String(menuOpen),
      },
      '⋯',
    ),
  );

  if (!menuOpen) return wrap;

  const menu = h(
    'div',
    { class: 'ff-menu', role: 'menu' },
    h('div', { class: 'ff-menu-label' }, t.moveTo),
  );
  for (const f of store.folders) {
    menu.append(
      h(
        'button',
        {
          class: 'ff-menu-item',
          role: 'menuitem',
          'data-action': 'move-channel',
          'data-login': ch.login,
          'data-target': f.id,
          disabled: f.id === folderId,
        },
        `${f.id === folderId ? '✓ ' : ''}📁 ${f.name}`,
      ),
    );
  }
  menu.append(
    h(
      'button',
      {
        class: 'ff-menu-item',
        role: 'menuitem',
        'data-action': 'move-channel-new',
        'data-login': ch.login,
      },
      `＋ ${t.newFolder}`,
    ),
  );
  if (folderId !== null) {
    menu.append(
      h(
        'button',
        {
          class: 'ff-menu-item',
          role: 'menuitem',
          'data-action': 'move-channel',
          'data-login': ch.login,
          'data-target': UNSORTED_ID,
        },
        `↩ ${t.removeFromFolder}`,
      ),
    );
  }
  const container = h('div', {}, wrap, menu);
  return container;
}
