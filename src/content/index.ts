import css from './styles.css?inline';
import {
  addFolder,
  buildView,
  deleteFolder,
  moveChannel,
  moveFolder,
  moveFolderBy,
  renameFolder,
  toggleFolder,
  updateCache,
  newId,
} from '../shared/model';
import { t } from '../shared/strings';
import { loadStore, onStoreChanged, saveStore } from '../shared/storage';
import type { LiveChannel, Store } from '../shared/types';
import {
  channelsSignature,
  findFollowedSection,
  isSideNavExpanded,
  readFollowedChannels,
} from './reader';
import { initialUi, renderSidebar, UNSORTED_ID, type UiState } from './render';
import { SEL } from './selectors';

const ROOT_ID = 'ff-root';
const STYLE_ID = 'ff-style';
const LOG = '[FollowFolders]';

/** Contrôleur principal : lit la barre Twitch, affiche les dossiers, réagit aux actions. */
class FollowFolders {
  private store!: Store;
  private live: LiveChannel[] = [];
  private liveSig = '';
  private ui: UiState = initialUi();
  private root: HTMLElement | null = null;
  private section: HTMLElement | null = null;

  private tickTimer: number | undefined;
  private saveTimer: number | undefined;
  private lastSavedJson = '';
  private pendingRender = false;
  private dragging: { kind: 'channel'; login: string } | { kind: 'folder'; id: string } | null =
    null;
  private showMoreClicks = 0;
  private lastShowMoreClick = 0;
  private failed = false;

  async start(): Promise<void> {
    this.store = await loadStore();
    this.lastSavedJson = JSON.stringify(this.store);
    injectStyle();

    onStoreChanged((next) => {
      const json = JSON.stringify(next);
      if (json === this.lastSavedJson) return; // notre propre sauvegarde
      this.lastSavedJson = json;
      this.store = next;
      this.failed = false;
      this.scheduleTick(0);
      this.render();
    });

    new MutationObserver((mutations) => {
      // On ignore le reste de la page (chat…) et nos propres changements :
      // seules les mutations de la barre latérale Twitch nous intéressent.
      const nav = document.querySelector(SEL.sideNav);
      const relevant = mutations.some((m) => {
        if (this.root?.contains(m.target)) return false;
        return !nav || nav.contains(m.target) || m.target.contains(nav);
      });
      if (relevant) this.scheduleTick();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    // Filet de sécurité : Twitch met parfois à jour les spectateurs sans mutation de structure.
    window.setInterval(() => this.scheduleTick(0), 5000);
    document.addEventListener('pointerdown', (e) => this.onOutsidePointer(e), true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (this.ui.menu || this.ui.confirmDeleteId)) {
        this.ui.menu = null;
        this.ui.confirmDeleteId = null;
        this.render();
      }
    });

    this.tick();
  }

  // ───────────────────────── Cycle de lecture ─────────────────────────

  /** Regroupe les demandes : au plus une lecture toutes les `delay` ms, même si Twitch bouge sans arrêt. */
  private scheduleTick(delay = 200): void {
    if (this.tickTimer !== undefined) return;
    this.tickTimer = window.setTimeout(() => {
      this.tickTimer = undefined;
      this.tick();
    }, delay);
  }

  private tick(): void {
    if (!this.store.settings.enabled || this.failed) return this.unmount();
    if (!isSideNavExpanded()) return this.unmount(); // mode icônes : on laisse Twitch tel quel

    const section = findFollowedSection();
    if (!section) return this.unmount();

    this.mount(section);
    this.autoLoadAll(section);

    const live = readFollowedChannels(section);
    const sig = channelsSignature(live);
    if (sig !== this.liveSig) {
      this.liveSig = sig;
      this.live = live;
      const cached = updateCache(this.store, live);
      if (cached !== this.store) this.commit(cached, false);
      this.render();
    }
  }

  /** Clique sur « Show More » jusqu'à ce que toute la liste soit chargée. */
  private autoLoadAll(section: HTMLElement): void {
    if (!this.store.settings.autoLoadAll) return;
    const btn = section.querySelector<HTMLElement>(SEL.showMoreButton);
    if (!btn) return;
    const now = Date.now();
    // Twitch recharge parfois la liste : on autorise une nouvelle série de clics après une minute de calme.
    if (now - this.lastShowMoreClick > 60_000) this.showMoreClicks = 0;
    if (now - this.lastShowMoreClick < 400 || this.showMoreClicks > 60) return;
    this.lastShowMoreClick = now;
    this.showMoreClicks++;
    btn.click();
    this.scheduleTick(500);
  }

  // ───────────────────────── Montage dans la page ─────────────────────────

  private mount(section: HTMLElement): void {
    if (this.section !== section) {
      this.section?.removeAttribute('data-ff-hidden');
      this.section = section;
      this.showMoreClicks = 0;
      this.liveSig = '';
    }
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = ROOT_ID;
      this.root.className = 'ff-root';
      this.root.setAttribute('role', 'group');
      this.root.setAttribute('aria-label', t.sectionTitle);
      this.bindEvents(this.root);
    }
    if (this.root.nextElementSibling !== section || !this.root.isConnected) {
      section.parentElement?.insertBefore(this.root, section);
      this.render();
    }
    section.setAttribute('data-ff-hidden', '');
  }

  private unmount(): void {
    this.section?.removeAttribute('data-ff-hidden');
    document
      .querySelectorAll('[data-ff-hidden]')
      .forEach((el) => el.removeAttribute('data-ff-hidden'));
    this.root?.remove();
    this.section = null;
    this.liveSig = '';
  }

  // ───────────────────────── Rendu ─────────────────────────

  private render(): void {
    if (!this.root || !this.root.isConnected) return;
    // Pas de re-rendu pendant un glisser-déposer ou une saisie : on le fera juste après.
    if (this.dragging || this.root.querySelector('.ff-rename-input:focus')) {
      this.pendingRender = true;
      return;
    }
    this.pendingRender = false;
    try {
      const view = buildView(this.store, this.live);
      this.root.replaceChildren(renderSidebar(view, this.store, this.ui));
      const input = this.root.querySelector<HTMLInputElement>('.ff-rename-input');
      if (input) {
        input.focus();
        input.select();
      }
    } catch (err) {
      // En cas de bug, on rend la barre Twitch d'origine plutôt que de laisser un trou.
      console.error(LOG, "erreur d'affichage, retour à la liste Twitch", err);
      this.failed = true;
      this.unmount();
    }
  }

  private flushPendingRender(): void {
    if (this.pendingRender) this.render();
  }

  // ───────────────────────── Sauvegarde ─────────────────────────

  private commit(next: Store, rerender = true): void {
    this.store = next;
    this.lastSavedJson = JSON.stringify(next);
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      saveStore(this.store).catch((err) => console.error(LOG, 'sauvegarde impossible', err));
    }, 250);
    if (rerender) this.render();
  }

  // ───────────────────────── Événements ─────────────────────────

  private bindEvents(root: HTMLElement): void {
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('keydown', (e) => this.onKeyDown(e));
    root.addEventListener('focusout', (e) => this.onFocusOut(e));
    root.addEventListener('dragstart', (e) => this.onDragStart(e));
    root.addEventListener('dragover', (e) => this.onDragOver(e));
    root.addEventListener('dragleave', (e) => this.onDragLeave(e));
    root.addEventListener('drop', (e) => this.onDrop(e));
    root.addEventListener('dragend', () => this.onDragEnd());
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Clic sur une chaîne : on délègue au lien Twitch d'origine pour garder la navigation instantanée.
    const card = target.closest<HTMLAnchorElement>('a.ff-card');
    if (card) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const login = card.dataset.login;
      const native = this.section?.querySelector<HTMLAnchorElement>(
        `${SEL.followedCard}[href="/${login}" i]`,
      );
      if (native) {
        e.preventDefault();
        native.click();
      }
      return;
    }

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl || !this.root?.contains(actionEl)) return;
    const action = actionEl.dataset.action;
    const folderId = actionEl.dataset.folderId ?? '';
    const login = actionEl.dataset.login ?? '';
    e.preventDefault();
    e.stopPropagation();

    switch (action) {
      case 'new-folder': {
        const id = newId();
        this.ui = { ...initialUi(), renamingId: id };
        this.commit(addFolder(this.store, t.defaultFolderName, id));
        break;
      }
      case 'toggle':
        if (folderId === UNSORTED_ID) {
          this.commit({ ...this.store, unsortedCollapsed: !this.store.unsortedCollapsed });
        } else {
          this.commit(toggleFolder(this.store, folderId));
        }
        break;
      case 'folder-menu':
        this.ui.confirmDeleteId = null;
        this.ui.menu =
          this.ui.menu?.kind === 'folder' && this.ui.menu.id === folderId
            ? null
            : { kind: 'folder', id: folderId };
        this.render();
        break;
      case 'channel-menu':
        this.ui.menu =
          this.ui.menu?.kind === 'channel' && this.ui.menu.login === login
            ? null
            : { kind: 'channel', login };
        this.render();
        break;
      case 'close-menu':
        this.ui = { ...this.ui, menu: null, confirmDeleteId: null };
        this.render();
        break;
      case 'rename':
        this.ui = { ...initialUi(), renamingId: folderId };
        this.render();
        break;
      case 'move-up':
      case 'move-down':
        this.ui.menu = null;
        this.commit(moveFolderBy(this.store, folderId, action === 'move-up' ? -1 : 1));
        break;
      case 'delete':
        this.ui.confirmDeleteId = folderId;
        this.render();
        break;
      case 'delete-confirm':
        this.ui = initialUi();
        this.commit(deleteFolder(this.store, folderId));
        break;
      case 'move-channel': {
        const dest = actionEl.dataset.target ?? UNSORTED_ID;
        this.ui.menu = null;
        this.commit(moveChannel(this.store, login, dest === UNSORTED_ID ? null : dest));
        break;
      }
      case 'move-channel-new': {
        const id = newId();
        this.ui = { ...initialUi(), renamingId: id };
        this.commit(moveChannel(addFolder(this.store, t.defaultFolderName, id), login, id));
        break;
      }
      case 'toggle-unsorted-offline':
        this.commit({
          ...this.store,
          settings: {
            ...this.store.settings,
            showOfflineInUnsorted: !this.store.settings.showOfflineInUnsorted,
          },
        });
        break;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.matches('.ff-rename-input')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.finishRename(target as HTMLInputElement, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.finishRename(target as HTMLInputElement, false);
      }
      e.stopPropagation(); // ne pas déclencher les raccourcis clavier de Twitch
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && target.matches('.ff-folder-header')) {
      e.preventDefault();
      target.click();
    }
  }

  private onFocusOut(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    if (target.matches('.ff-rename-input')) this.finishRename(target as HTMLInputElement, true);
  }

  private finishRename(input: HTMLInputElement, save: boolean): void {
    const id = input.dataset.renameId;
    if (!id || this.ui.renamingId !== id) return;
    this.ui.renamingId = null;
    input.blur();
    if (save) this.commit(renameFolder(this.store, id, input.value));
    else this.render();
  }

  private onOutsidePointer(e: PointerEvent): void {
    if (!this.ui.menu && !this.ui.confirmDeleteId) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ff-menu, .ff-more, .ff-card-more')) return;
    this.ui.menu = null;
    this.ui.confirmDeleteId = null;
    this.render();
  }

  // ───────────────────────── Glisser-déposer ─────────────────────────

  private onDragStart(e: DragEvent): void {
    const target = e.target as HTMLElement;
    const wrap = target.closest<HTMLElement>('[data-drag-login]');
    const header = target.closest<HTMLElement>('.ff-folder-header[draggable="true"]');
    if (wrap && e.dataTransfer) {
      const login = wrap.dataset.dragLogin!;
      this.dragging = { kind: 'channel', login };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `https://www.twitch.tv/${login}`);
      wrap.classList.add('ff-dragging');
    } else if (header && e.dataTransfer && header.dataset.folderId !== UNSORTED_ID) {
      this.dragging = { kind: 'folder', id: header.dataset.folderId! };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', header.dataset.folderId!);
    }
  }

  private dropTargetAt(e: DragEvent): HTMLElement | null {
    return (e.target as HTMLElement).closest<HTMLElement>('[data-drop-folder]');
  }

  private clearDropMarks(): void {
    this.root
      ?.querySelectorAll('.ff-drop-target, .ff-drop-before, .ff-drop-after')
      .forEach((el) => el.classList.remove('ff-drop-target', 'ff-drop-before', 'ff-drop-after'));
  }

  private onDragOver(e: DragEvent): void {
    if (!this.dragging) return;
    const folderEl = this.dropTargetAt(e);
    if (!folderEl) return;
    const id = folderEl.dataset.dropFolder!;
    this.clearDropMarks();

    if (this.dragging.kind === 'channel') {
      e.preventDefault();
      folderEl.classList.add('ff-drop-target');
    } else if (id !== UNSORTED_ID && id !== this.dragging.id) {
      e.preventDefault();
      const rect = folderEl.getBoundingClientRect();
      const header = folderEl.querySelector('.ff-folder-header')?.getBoundingClientRect() ?? rect;
      folderEl.classList.add(
        e.clientY < header.top + header.height / 2 ? 'ff-drop-before' : 'ff-drop-after',
      );
    }
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  private onDragLeave(e: DragEvent): void {
    const related = e.relatedTarget as Node | null;
    if (!related || !this.root?.contains(related)) this.clearDropMarks();
  }

  private onDrop(e: DragEvent): void {
    const drag = this.dragging;
    const folderEl = this.dropTargetAt(e);
    if (!drag || !folderEl) return;
    e.preventDefault();
    const id = folderEl.dataset.dropFolder!;
    const after = folderEl.classList.contains('ff-drop-after');
    this.clearDropMarks();
    this.dragging = null;

    if (drag.kind === 'channel') {
      this.commit(moveChannel(this.store, drag.login, id === UNSORTED_ID ? null : id));
    } else if (id !== UNSORTED_ID && id !== drag.id) {
      const index = this.store.folders.findIndex((f) => f.id === id);
      this.commit(moveFolder(this.store, drag.id, after ? index + 1 : index));
    } else {
      this.render();
    }
  }

  private onDragEnd(): void {
    this.dragging = null;
    this.clearDropMarks();
    this.root?.querySelectorAll('.ff-dragging').forEach((el) => el.classList.remove('ff-dragging'));
    this.flushPendingRender();
  }
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  (document.head ?? document.documentElement).append(style);
}

new FollowFolders().start().catch((err) => console.error(LOG, err));
