# Couverture fonctionnelle API

Les interfaces consomment l’API NestJS existante sous `/api/v1`. Les formes de requête et autorisations sont définies dans le backend `isieco-report`.

| Parcours | Endpoints utilisés | Client |
|---|---|---|
| Connexion et profil métier | Supabase Auth, `GET /accounts/me` | Web + Mobile |
| Centre de commandement | `GET /command-center/overview` | Web |
| Signalements citoyens | `GET /reports`, `GET /reports/:id`, `POST /reports`, `POST /reports/with-photo` | Web + Mobile |
| Historique et pièces privées | `GET /reports/:id/history`, `GET /reports/:id/supplements`, `GET /reports/:id/photos/:photoId/url` | Mobile |
| Réponse à une demande de complément | `POST /reports/:id/supplements/:demandeId/responses` | Mobile |
| Qualification | `GET /qualification/queue`, `GET /qualification/:id`, `POST /qualification/:id/accept`, `POST /qualification/:id/reject`, `POST /qualification/:id/supplements` | Web |
| Création et suivi des dossiers | `GET /cases`, `GET /cases/qualified-reports`, `POST /cases/from-reports/:reportId`, `GET /cases/:id`, `GET /cases/:id/history`, `PATCH /cases/:id/priority` | Web |
| Affectations et réaffectation | `GET /assignments/pending-contents`, `GET /assignments/eligible-teams/:wasteTypeId`, `POST /assignments`, `POST /assignments/:id/reassign` | Web |
| Réponse des équipes | `GET /assignments/team/:teamId`, `POST /assignments/:id/response` | Web + Mobile |
| Interventions terrain | `GET /interventions/my-teams`, `GET /interventions/team/:teamId`, `POST /interventions/assignments/:assignmentId/start`, `POST /interventions/:id/photos`, `POST /interventions/:id/submit` | Web + Mobile |
| Vérification indépendante | `GET /verification/pending`, `GET /verification/assignments/:id`, `POST /verification/assignments/:id/decision` | Web |
| Référentiels | `GET/POST /referentials/teams`, `GET/POST/PATCH /referentials/waste-types`, memberships, skills | Web |
| Administration des rôles | `GET /accounts`, `POST /accounts/:id/roles`, `DELETE /accounts/:id/roles/:code` | Web |

## Contraintes métier et sécurité prises en compte

- Les rôles sont lus depuis le profil API mais chaque accès est toujours revalidé par le backend.
- Une demande de complément, un rejet et une reprise exigent leur motif.
- Une qualification conserve uniquement les catégories retenues par l’agent habilité.
- Les affectations et réaffectations exigent une clé `Idempotency-Key`.
- La réponse d’une équipe exige un motif lors d’un refus.
- Le compte rendu terrain exige au moins 20 caractères ; un motif est requis pour les résultats partiels ou impossibles.
- Le vérificateur ne peut pas valider sa propre intervention.
- Les preuves photos transitent par les endpoints backend. Les URL Storage sont signées et temporaires ; aucun chemin privé n’est envoyé au client.
