# Décisions d’architecture
## Frontend indépendant
Le dépôt `isieco-clients` porte le Web et le Mobile. Le dépôt `isieco-report` reste la source de vérité du backend NestJS, des règles métier et des contrats API.
## Authentification et sécurité
- Supabase Auth authentifie les utilisateurs et fournit le jeton d’accès.
- Tous les appels métier passent par `/api/v1` avec `Authorization: Bearer`.
- Le profil métier est chargé depuis `GET /accounts/me`; les rôles sont lus dans `roles[].code`.
- Les habilitations affichées dans le client ne constituent jamais une barrière de sécurité. L’API contrôle chaque accès.
- Aucune clé `service_role`, aucun secret serveur et aucun chemin Storage ne sont embarqués dans les clients.
## Applications
- Web : React, TypeScript, Vite, React Router et Leaflet.
- Mobile : Expo, React Native et Expo Router.
- HTTP et clés idempotentes : package partagé `@isieco/api-client`.
- Couleurs et typographie : package partagé `@isieco/design-tokens`.
## Carte
Le centre de commandement consomme `GET /command-center/overview`. Les coordonnées réelles renvoyées par `map.items` sont utilisées. Les objets sans latitude/longitude ne sont pas affichés et aucune adresse n’est estimée.
## Staging
La configuration cible le staging Render et le projet Supabase existants. Le dépôt client ne modifie pas les services Render, bases de données ou variables de production.
