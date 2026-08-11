# Graph Report - .  (2026-08-09)

## Corpus Check
- 151 files · ~50,650 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 686 nodes · 1566 edges · 33 communities (29 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- Community 26
- Community 27
- Community 28
- Community 29

## God Nodes (most connected - your core abstractions)
1. `cn()` - 79 edges
2. `requireUser()` - 37 edges
3. `buttonVariants` - 23 edges
4. `requireAdmin()` - 18 edges
5. `requireProfile()` - 16 edges
6. `compilerOptions` - 16 edges
7. `formatPrice()` - 14 edges
8. `parseM3u()` - 13 edges
9. `getUserPlaylist()` - 13 edges
10. `fieldErrorsFrom()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `RegisterForm()` --indirect_call--> `registerAction()`  [INFERRED]
  components/auth/register-form.tsx → app/actions/auth.ts
- `StatusPill()` --calls--> `cn()`  [EXTRACTED]
  components/admin/status-pill.tsx → lib/utils.ts
- `Badge()` --calls--> `cn()`  [EXTRACTED]
  components/ui/badge.tsx → lib/utils.ts
- `HomePage()` --calls--> `buttonVariants`  [EXTRACTED]
  app/(app)/inicio/page.tsx → components/ui/button.tsx
- `HomePage()` --calls--> `getUserPlaylist()`  [EXTRACTED]
  app/(app)/inicio/page.tsx → lib/queries/iptv.ts

## Import Cycles
- None detected.

## Communities (33 total, 4 thin omitted)

### Community 0 - "Auth & Session Management"
Cohesion: 0.05
Nodes (57): AuthFormState, clientIp(), loginAction(), registerAction(), safeNext(), COOKIE_OPTIONS, createProfileAction(), deleteProfileAction() (+49 more)

### Community 1 - "VOD Playback & Watchlist"
Cohesion: 0.06
Nodes (61): toggleWatchlistAction(), metadata, WatchPage(), metadata, SearchPage(), HomePage(), metadata, metadata (+53 more)

### Community 2 - "IPTV Navigation & Layout"
Cohesion: 0.06
Nodes (37): logoutAction(), saveProgressAction(), switchProfileAction(), SeasonTabs(), SeasonTabsProps, AdminSidebar(), NAV, Folder (+29 more)

### Community 3 - "Marketing & Registration"
Cohesion: 0.06
Nodes (40): metadata, RegisterPage(), LandingPage(), metadata, TICKER_ITEMS, AuthShell(), INITIAL, RegisterForm() (+32 more)

### Community 4 - "Admin Content Management"
Cohesion: 0.07
Nodes (43): AdminFormState, currentPublishedAt(), deleteEpisodeAction(), deleteTitleAction(), isUniqueViolation(), toggleUserBlockAction(), upsertEpisodeAction(), upsertTitleAction() (+35 more)

### Community 5 - "IPTV Player & TMDB Integration"
Cohesion: 0.10
Nodes (35): toggleChannelFavoriteAction(), GET(), RATING_MAP, cleanNameForTmdb(), WatchChannelPage(), TvSearchPage(), GroupPage(), TvPage() (+27 more)

### Community 6 - "Build & Config Dependencies"
Cohesion: 0.05
Nodes (42): autoprefixer, eslint, eslint-config-next, devDependencies, autoprefixer, eslint, eslint-config-next, postcss (+34 more)

### Community 7 - "Admin Customer Management"
Cohesion: 0.11
Nodes (28): CustomerDetailPage(), CustomersPage(), EditTitlePage(), NewTitlePage(), ContentPage(), FILTERS, IptvPage(), AdminDashboardPage() (+20 more)

### Community 8 - "M3U Sync & IPTV API"
Cohesion: 0.13
Nodes (28): POST(), GET(), handleSync(), POST(), CATEGORY_ICONS, detectCategory(), detectCountry(), detectLanguage() (+20 more)

### Community 9 - "Shared Libraries & Utils"
Cohesion: 0.06
Nodes (33): @auth/prisma-adapter, bcryptjs, class-variance-authority, clsx, framer-motion, hls.js, ioredis, lucide-react (+25 more)

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
Cohesion: 0.39
Nodes (7): detectCategory(), detectQuality(), extractAttr(), prisma, { PrismaClient }, run(), slugify()

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (5): @auth/core/jwt, JWT, next-auth, Session, User

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (3): anton, inter, metadata

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): extends, rules, @next/next/no-img-element, next/core-web-vitals

## Knowledge Gaps
- **201 isolated node(s):** `next/core-web-vitals`, `@next/next/no-img-element`, `metadata`, `metadata`, `metadata` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `IPTV Navigation & Layout` to `Auth & Session Management`, `VOD Playback & Watchlist`, `Marketing & Registration`, `Admin Content Management`, `IPTV Player & TMDB Integration`, `Admin Customer Management`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `VOD Playback & Watchlist` to `Auth & Session Management`, `IPTV Navigation & Layout`, `Admin Content Management`, `IPTV Player & TMDB Integration`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `requireAdmin()` connect `Admin Content Management` to `M3U Sync & IPTV API`, `VOD Playback & Watchlist`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `@next/next/no-img-element`, `metadata` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & Session Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05389942788316772 - nodes in this community are weakly interconnected._
- **Should `VOD Playback & Watchlist` be split into smaller, more focused modules?**
  _Cohesion score 0.05660945498343872 - nodes in this community are weakly interconnected._
- **Should `IPTV Navigation & Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.06428988895382817 - nodes in this community are weakly interconnected._