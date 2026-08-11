# Graph Report - TVHUB  (2026-08-11)

## Corpus Check
- 212 files · ~129,121 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1083 nodes · 2628 edges · 74 communities (64 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `90168f6c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Auth & Session Management
- VOD Playback & Watchlist
- IPTV Navigation & Layout
- Marketing & Registration
- Admin Content Management
- IPTV Player & TMDB Integration
- Build & Config Dependencies
- Admin Customer Management
- M3U Sync & IPTV API
- Shared Libraries & Utils
- TypeScript Config & Types
- Database Migrations
- Commons Media Library
- Payment Provider
- File Upload & Storage
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 22
- Community 23
- Community 26
- Community 27
- Community 28
- Community 29
- Community 31
- Community 32
- page.tsx
- requireUser
- auth.ts
- Plano de migração para o protótipo v4 — HUBFLIX
- page.tsx
- iptv-player.tsx
- discover.ts
- app-topbar.tsx
- 2. Provedores comparados
- tv-nav.tsx
- Regras para não quebrar o TVHub
- scripts
- browserslist
- logo.tsx
- site-header.tsx
- admin-sidebar.tsx
- page.tsx
- O ciclo do dia a dia
- faq.tsx
- Como trabalhar neste projeto
- Deploy
- Quando algo dá errado
- package.json
- TVHub
- server-entry.js
- page.tsx
- Configuração (uma vez só)
- clean-name.ts
- catalog.ts
- migration.sql
- status-chip.tsx
- autoprefixer
- prisma
- @types/bcryptjs
- @types/node
- migration.sql

## God Nodes (most connected - your core abstractions)
1. `cn()` - 113 edges
2. `requireUser()` - 51 edges
3. `cleanMediaTitle()` - 28 edges
4. `getViewablePlaylist()` - 24 edges
5. `buttonVariants` - 23 edges
6. `enrichChannelsWithTmdb()` - 21 edges
7. `dedupeChannels()` - 21 edges
8. `requireAdmin()` - 20 edges
9. `matchTmdbInPlaylist()` - 18 edges
10. `syncPlaylist()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `KidsSpotlight()` --calls--> `cleanMediaTitle()`  [EXTRACTED]
  app/(app)/tv/kids/page.tsx → lib/utils.ts
- `RegisterForm()` --indirect_call--> `registerAction()`  [INFERRED]
  components/auth/register-form.tsx → app/actions/auth.ts
- `AdminLayout()` --calls--> `requireAdmin()`  [EXTRACTED]
  app/admin/layout.tsx → lib/auth/session.ts
- `M3uChannelPreview()` --calls--> `cn()`  [EXTRACTED]
  components/admin/iptv/m3u-channel-preview.tsx → lib/utils.ts
- `StatusPill()` --calls--> `cn()`  [EXTRACTED]
  components/admin/status-pill.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (74 total, 10 thin omitted)

### Community 0 - "Auth & Session Management"
Cohesion: 0.13
Nodes (22): COOKIE_OPTIONS, createProfileAction(), deleteProfileAction(), ProfileFormState, unlockProfileAction(), updateProfileAction(), INITIAL, PinDialog() (+14 more)

### Community 1 - "VOD Playback & Watchlist"
Cohesion: 0.05
Nodes (63): saveProgressAction(), toggleWatchlistAction(), POST(), POST(), metadata, WatchPage(), metadata, SearchPage() (+55 more)

### Community 2 - "IPTV Navigation & Layout"
Cohesion: 0.27
Nodes (8): logoutAction(), selectProfileAction(), switchProfileAction(), NAV, ProfileAvatar(), tintFor(), TINTS, UserProfileMenu()

### Community 3 - "Marketing & Registration"
Cohesion: 0.12
Nodes (14): metadata, TICKER_ITEMS, AnnouncementBar(), EASE, FEATURES, EASE, HowItWorks(), STEPS (+6 more)

### Community 4 - "Admin Content Management"
Cohesion: 0.06
Nodes (54): AdminFormState, currentPublishedAt(), deleteEpisodeAction(), deleteTitleAction(), isUniqueViolation(), toggleUserBlockAction(), upsertEpisodeAction(), upsertTitleAction() (+46 more)

### Community 5 - "IPTV Player & TMDB Integration"
Cohesion: 0.10
Nodes (29): GET(), RATING_MAP, cleanNameForTmdb(), WatchChannelPage(), Episode, SeriesPage(), QUALITY_STYLES, QualityBadge() (+21 more)

### Community 6 - "Build & Config Dependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, postcss, tailwindcss, tsx (+9 more)

### Community 7 - "Admin Customer Management"
Cohesion: 0.06
Nodes (56): AdminAuditoriaPage(), CustomerDetailPage(), CustomersPage(), EditTitlePage(), NewTitlePage(), ContentPage(), FILTERS, IptvPage() (+48 more)

### Community 8 - "M3U Sync & IPTV API"
Cohesion: 0.09
Nodes (46): POST(), GET(), handleSync(), POST(), AiCategorizationResult, AiRecommendationRequest, AiRecommendationResponse, categorizeGroupsWithAi() (+38 more)

### Community 9 - "Shared Libraries & Utils"
Cohesion: 0.05
Nodes (37): @auth/prisma-adapter, bcryptjs, class-variance-authority, clsx, framer-motion, hls.js, ioredis, lucide-react (+29 more)

### Community 10 - "TypeScript Config & Types"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 11 - "Database Migrations"
Cohesion: 0.21
Nodes (19): "Account", "AuditLog", "Collection", "CollectionItem", "Episode", "Genre", "_GenreToTitle", "Payment" (+11 more)

### Community 12 - "Commons Media Library"
Cohesion: 0.17
Nodes (13): clean(), CommonsMedia, Derivative, PREFERRED, resolveCommonsMedia(), CC_ANIMATION, COMMONS_CLASSICS, KIDS_ANIMATION (+5 more)

### Community 13 - "Payment Provider"
Cohesion: 0.17
Nodes (8): Charge, CreateChargeInput, getPaymentProvider(), isPaymentConfigured(), notConfiguredProvider, PaymentProvider, PaymentProviderNotConfiguredError, WebhookResult

### Community 14 - "File Upload & Storage"
Cohesion: 0.25
Nodes (7): ALLOWED_FOLDERS, POST(), ALLOWED_MIME, getStorageProvider(), localStorage, StorageProvider, UploadValidationError

### Community 15 - "Community 15"
Cohesion: 0.32
Nodes (4): AUTH_PAGES, authorized(), PROTECTED_PREFIXES, config

### Community 16 - "Community 16"
Cohesion: 0.32
Nodes (7): backdrop(), GENRES, main(), poster(), prisma, SERIES, TITLES

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (21): toggleChannelFavoriteAction(), metadata, CHANNEL_SELECT, COMPETITIONS, metadata, ContinueWatchingRail(), formatMinutesLeft(), FavoriteButton() (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (5): @auth/core/jwt, JWT, next-auth, Session, User

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (39): KidsHubPage(), KidsSpotlight(), toKidsCard(), Episode, episodeTitle(), SeasonTabs(), anton, metadata (+31 more)

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): extends, rules, @next/next/no-img-element, next/core-web-vitals

### Community 22 - "Community 22"
Cohesion: 0.40
Nodes (7): fetchUpstream(), GET(), streamToBuffer(), reconcileContentRange(), assertPublicStreamUrl(), BLOCKED_HOSTNAMES, isPrivateIpv4()

### Community 23 - "Community 23"
Cohesion: 0.26
Nodes (7): PillItem, PillNav(), activeIndex(), Tab, TabBar(), TABS, observeResize()

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (23): GroupPage(), capitalize(), LiveChannelsPage(), RAILS, FavoritesRail(), CategoryTiles(), ICONS, clientIp() (+15 more)

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (21): Episode, INITIAL, Folder, ImageUpload(), Genre, INITIAL, TitleData, Result (+13 more)

### Community 33 - "page.tsx"
Cohesion: 0.14
Nodes (22): metadata, AiPicksRail(), buildHeroSlides(), ContinueWatchingSection(), heroFallback(), HeroSection(), KidsRail(), ReleasesRail() (+14 more)

### Community 34 - "requireUser"
Cohesion: 0.21
Nodes (22): TvSearchPage(), DicasPage(), MoviesHubPage(), NovelasPage(), AcclaimedRail(), SeriesRails(), trendingRow(), TvPage() (+14 more)

### Community 35 - "auth.ts"
Cohesion: 0.21
Nodes (14): AuthFormState, loginAction(), registerAction(), resendOtpAction(), safeNext(), INITIAL, LoginForm(), createTransporter() (+6 more)

### Community 36 - "Plano de migração para o protótipo v4 — HUBFLIX"
Cohesion: 0.11
Nodes (17): 10. Ordem de execução, 11. O que não vamos fazer, 1. Resumo executivo, 2. Filmes e séries (aba principal), 3. Canais, 4. Esportes — leia antes de investir, 5. Novelas e Dicas, 6. Perfis e faixas etárias (+9 more)

### Community 37 - "page.tsx"
Cohesion: 0.19
Nodes (13): heroFrom(), Row(), PosterRail(), TopMoviesRail(), Row(), FilterBar(), showcaseHref(), FILTER_GROUPS (+5 more)

### Community 38 - "iptv-player.tsx"
Cohesion: 0.22
Nodes (11): BUFFER_INICIAL, buildStreamVariants(), IptvPlayer(), PlayerState, PRAZO_PRIMEIRO_QUADRO, BufferPlan, ConnectionProfile, detectConnectionProfile() (+3 more)

### Community 39 - "discover.ts"
Cohesion: 0.20
Nodes (11): cached(), inFlight, TTL, CandidateChannel, pickBestVersion(), ShowcaseItem, TmdbSearchResult, qualityRank() (+3 more)

### Community 40 - "app-topbar.tsx"
Cohesion: 0.21
Nodes (8): AppTopbar(), IconButton(), titleFor(), TITLES, isActive(), Item, ITEMS, SideNav()

### Community 41 - "2. Provedores comparados"
Cohesion: 0.17
Nodes (11): 1. O que cada esporte precisa, 2. Provedores comparados, 3. Recomendação, 4. EPG — grátis, não precisa pagar, API-SPORTS — **recomendado para começar**, APIs necessárias — Esportes e EPG, BALLDONTLIE, Fontes (+3 more)

### Community 42 - "tv-nav.tsx"
Cohesion: 0.26
Nodes (8): CastModal(), ReportModal(), getCategoryTitle(), KIDS_LINKS, STANDARD_LINKS, TvNav(), Modal(), ModalProps

### Community 43 - "Regras para não quebrar o TVHub"
Cohesion: 0.17
Nodes (12): 1. O `next build` nunca roda na VPS, 2. Os limites de memória no `tvhub-stack.yml` não são sugestão, 3. Nomes de serviço são sempre qualificados (`tvhub_postgres`, não `postgres`), 4. `restart_policy: condition: any`, nunca `on-failure`, 5. Mudou o `schema.prisma`? Gerou migration. Sem exceção., 6. Migration em produção só adiciona. Nunca remove nem renomeia., 7. `/api/health` e `/api/ready` são coisas diferentes — não unifique, 8. Segredo de produção mora em `/opt/tvhub/.env`, na VPS (+4 more)

### Community 44 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, db:generate, db:migrate, db:push, db:seed, db:seed:open, db:studio (+4 more)

### Community 45 - "browserslist"
Cohesion: 0.20
Nodes (10): browserslist, and_chr >= 49, chrome >= 49, edge >= 18, firefox >= 52, ios_saf >= 10, not dead, opera >= 40 (+2 more)

### Community 46 - "logo.tsx"
Cohesion: 0.28
Nodes (5): metadata, AuthShell(), SHOWCASE_SLIDES, LogoHMark(), SIZES

### Community 47 - "site-header.tsx"
Cohesion: 0.32
Nodes (4): LINKS, SiteFooter(), SiteHeader(), SITE

### Community 48 - "admin-sidebar.tsx"
Cohesion: 0.33
Nodes (5): AdminLayout(), metadata, AdminSidebar(), NAV, Logo()

### Community 49 - "page.tsx"
Cohesion: 0.38
Nodes (5): metadata, RegisterPage(), FALLBACK_PLANS, getPublicPlans(), PlanCard

### Community 50 - "O ciclo do dia a dia"
Cohesion: 0.29
Nodes (7): 1. Branch a partir da `main` atualizada, 2. Faça a mudança, 3. Confira antes de subir, 4. Mexeu no banco?, 5. Commit e push, 6. Pull Request, O ciclo do dia a dia

### Community 51 - "faq.tsx"
Cohesion: 0.47
Nodes (4): Faq(), ITEMS, Accordion(), AccordionItem

### Community 52 - "Como trabalhar neste projeto"
Cohesion: 0.33
Nodes (6): Como trabalhar neste projeto, Deploy, O que o CI verifica, Onde as coisas ficam, Primeira vez na máquina, Regras que não se negociam

### Community 53 - "Deploy"
Cohesion: 0.33
Nodes (6): Caminho de emergência (GitHub fora do ar), Deploy, O limite honesto, O que acontece quando você faz merge na `main`, O que continua manual, Por que o site não cai

### Community 54 - "Quando algo dá errado"
Cohesion: 0.33
Nodes (6): O deploy travou em "aguardando convergência", Publicar uma versão específica, Qual código está no ar, Quando algo dá errado, Ver o que está acontecendo, Voltar para a versão anterior

### Community 55 - "package.json"
Cohesion: 0.33
Nodes (5): name, prisma, seed, private, version

### Community 56 - "TVHub"
Cohesion: 0.33
Nodes (6): Comece por aqui, Como está montado, Scripts, Stack, Subir localmente, TVHub

### Community 57 - "server-entry.js"
Cohesion: 0.33
Nodes (4): DRAIN_DELAY_MS, DRAIN_TIMEOUT_MS, fs, http

### Community 58 - "page.tsx"
Cohesion: 0.50
Nodes (4): metadata, ProfilesPage(), ProfileGrid(), listProfiles()

### Community 59 - "Configuração (uma vez só)"
Cohesion: 0.40
Nodes (5): 1. Secrets do repositório, 2. Portão de aprovação, 3. Na VPS, uma vez, 4. Proteja a `main`, Configuração (uma vez só)

### Community 60 - "clean-name.ts"
Cohesion: 0.60
Nodes (3): cleanChannelName(), seriesNameFromChannel(), tmdbQueryFromChannel()

### Community 61 - "catalog.ts"
Cohesion: 0.67
Nodes (3): LandingPage(), countPublishedTitles(), getShowcaseTitles()

### Community 63 - "migration.sql"
Cohesion: 0.50
Nodes (3): "M3uChannel", "M3uGroup", "M3uPlaylist"

## Knowledge Gaps
- **328 isolated node(s):** `next/core-web-vitals`, `@next/next/no-img-element`, `metadata`, `metadata`, `metadata` (+323 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 17` to `Auth & Session Management`, `VOD Playback & Watchlist`, `IPTV Navigation & Layout`, `Marketing & Registration`, `Admin Content Management`, `IPTV Player & TMDB Integration`, `Admin Customer Management`, `Community 19`, `Community 23`, `Community 31`, `Community 32`, `page.tsx`, `page.tsx`, `iptv-player.tsx`, `app-topbar.tsx`, `tv-nav.tsx`, `logo.tsx`, `site-header.tsx`, `admin-sidebar.tsx`, `faq.tsx`, `page.tsx`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `Auth & Session Management`, `VOD Playback & Watchlist`, `IPTV Navigation & Layout`, `page.tsx`, `Admin Content Management`, `IPTV Player & TMDB Integration`, `page.tsx`, `Community 17`, `Community 19`, `page.tsx`, `Community 31`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `requireAdmin()` connect `Admin Content Management` to `admin-sidebar.tsx`, `M3U Sync & IPTV API`, `requireUser`, `VOD Playback & Watchlist`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `@next/next/no-img-element`, `metadata` to the rest of the system?**
  _328 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & Session Management` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `VOD Playback & Watchlist` be split into smaller, more focused modules?**
  _Cohesion score 0.05230678812812224 - nodes in this community are weakly interconnected._
- **Should `Marketing & Registration` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._