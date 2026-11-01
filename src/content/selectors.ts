/**
 * TOUS les sélecteurs CSS de Twitch utilisés par l'extension sont ici.
 * Quand Twitch change son site, c'est en principe le seul fichier à corriger.
 *
 * Relevés le 01/11/2026 sur twitch.tv (barre latérale déployée, compte connecté).
 * On évite les classes générées (« Layout-sc-1xcs6mc-0 ») qui changent à chaque déploiement de Twitch.
 */
export const SEL = {
  /** Toute la barre latérale de gauche */
  sideNav: '[data-a-target="side-nav-bar"]',
  /** Classe présente sur la barre latérale quand elle est déployée (absente en mode icônes) */
  sideNavExpandedClass: 'side-nav--expanded',
  /** Chaque section de la barre (« Followed Channels », « Live Channels »…) */
  section: '.side-nav-section',
  /**
   * En-tête propre à la section « Followed Channels ».
   * On repère la section par sa structure plutôt que par son aria-label, qui est traduit
   * (« Followed Channels » / « Chaînes suivies »…).
   */
  followedHeader: '.followed-side-nav-header',
  /** Lien d'une chaîne suivie */
  followedCard: 'a[data-test-selector="followed-channel"]',
  /** Classe ajoutée sur le lien quand la chaîne est hors ligne */
  offlineCardClass: 'side-nav-card__link--offline',
  cardTitle: '[data-a-target="side-nav-title"]',
  cardMetadata: '[data-a-target="side-nav-card-metadata"]',
  cardGame: '.side-nav-card__metadata p',
  cardLiveStatus: '[data-a-target="side-nav-live-status"]',
  liveIndicator: '.tw-channel-status-indicator',
  avatarImg: 'img.tw-image-avatar',
  showMoreButton: '[data-a-target="side-nav-show-more-button"]',
  showLessButton: '[data-a-target="side-nav-show-less-button"]',
} as const;
