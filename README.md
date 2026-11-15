# ISIECO Clients

Nouvelle plateforme client ISIECO, reconstruite indépendamment du dépôt backend `fadellba/isieco-report`.

## Architecture

- `apps/web`: portail web du centre de commandement et des équipes opérationnelles.
- `apps/mobile`: application mobile citoyen et agent terrain.
- `packages/api-client`: client HTTP partagé, authentifié par le jeton Supabase.
- `packages/design-tokens`: fondations visuelles partagées.

Le backend NestJS existant reste la source de vérité métier. Les clients utilisent exclusivement l'API `/api/v1` et Supabase Auth. Les rôles et autorisations sont toujours validés par le backend.

## Staging

Configurer les variables publiques listées dans `.env.example`. L'URL API de staging par défaut est `https://isieco-api-staging.onrender.com/api/v1`. Le client ne contient aucune clé Supabase `service_role` ou secret serveur.

## Développement

```bash
corepack enable
pnpm install
pnpm dev:web
```

Pour l'application mobile :

```bash
pnpm dev:mobile
```

## Sécurité

- Les jetons d'accès ne sont jamais écrits dans le dépôt ni dans les logs applicatifs.
- Les médias privés passent par les endpoints backend et leurs URLs signées temporaires.
- Aucun rôle transmis par le navigateur ou l'application mobile ne fait autorité.
- Les projets Render et les variables de production du backend ne sont pas modifiés par ce dépôt.
