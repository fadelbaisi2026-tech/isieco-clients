# Couverture fonctionnelle API
| Domaine | Endpoint | Client |
|---|---|---|
| Profil métier | `GET /accounts/me` | Web + Mobile |
| Centre de commandement | `GET /command-center/overview` | Web |
| Signalements citoyens | `GET /reports`, `POST /reports`, `POST /reports/with-photo` | Mobile |
| Équipes terrain | `GET /interventions/my-teams` | Mobile + Web |
| Qualification | `GET /qualification/queue` | Web |
| Dossiers | `GET /cases` | Web |
| Affectations | `GET /assignments/pending-contents` | Web |
| Vérification | `GET /verification/pending` | Web |
| Référentiels | `GET /referentials/teams` | Web |
| Administration | `GET /accounts` | Web |
Les décisions métier détaillées (qualification, affectation, réponse d’équipe, soumission d’intervention, vérification et attribution de rôles) ne doivent être activées qu’après intégration des DTO et règles métier exacts du backend. Les écrans génériques actuels exposent les données consultables et indiquent l’endpoint utilisé, sans simuler d’actions.
