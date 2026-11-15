# ISIECO Clients

Reconstruction indépendante de la plateforme ISIECO. Ce dépôt contient le nouveau Web et le nouveau Mobile ; le backend NestJS existant demeure dans `fadellba/isieco-report` et reste l’unique source de vérité métier.

## Applications et packages

- `apps/web` : portail citoyen Web, centre de commandement, espaces agents et administration.
- `apps/mobile` : application Expo pour citoyens et agents de terrain.
- `packages/api-client` : client HTTP commun, authentification Bearer, erreurs et clés d’idempotence.
- `packages/design-tokens` : palette et fondations visuelles.
- `docs/architecture` et `docs/product` : architecture et couverture des parcours.

## Prérequis et démarrage

Node.js 22.13+ et pnpm 12+.

```bash
corepack enable
pnpm install
pnpm dev:web
```

Pour le mobile :

```bash
pnpm dev:mobile
```

Contrôles :

```bash
pnpm typecheck
pnpm build:web
pnpm build:mobile
```

## Configuration Staging

Les valeurs publiques de staging sont documentées dans `.env.example`. Copier les variables nécessaires dans l’environnement local ou dans Vercel :

- Web : `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Mobile : `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

L’API par défaut est `https://isieco-api-staging.onrender.com/api/v1`. La clé Supabase utilisée par les clients est la clé publique publishable du projet existant. Une clé `service_role`, un secret serveur ou un jeton d’administration ne doivent jamais être ajoutés à ce dépôt.

## Règles d’intégration

1. Supabase Auth authentifie la personne et fournit le jeton d’accès.
2. Les clients envoient `Authorization: Bearer <access-token>` à l’API.
3. Le profil métier et les rôles viennent de `GET /accounts/me`.
4. Les rôles affichés dans le client ne remplacent jamais les gardes backend.
5. Les fichiers privés sont transmis au backend. Les clients utilisent ses URL signées temporaires et ne connaissent pas les chemins Storage.
6. Les mutations qui l’exigent transmettent une clé `Idempotency-Key`.

## Déploiement

Vercel sert uniquement `apps/web` et construit depuis la racine du monorepo. La CI vérifie les types Web et Mobile, puis construit l’application Web. Android/iOS utilisent Expo/EAS ; Vercel ne distribue pas les binaires mobiles.

Le staging Render existant est utilisé tel quel. Ce dépôt ne modifie ni le backend, ni la base de données, ni les secrets ou environnements de production.
