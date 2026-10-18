# Validation du 19 octobre 2026

## Réalisé localement

- Python 3.14.6 : 28 tests Pytest réussis ; couverture 94,82 %.
- Ruff : lint et format conformes.
- Next.js 16.4.2 / React 19.3.1 : export statique et compilation TypeScript réussis.
- Playwright / Chromium : trois parcours réussis (filtres/inspecteur/export/mobile,
  rejet d'import invalide, crash-test JSON et export du diagnostic).
- Captures desktop et mobile examinées ; aucun débordement horizontal dans le
  test à 390 pixels. Pas d'audit complet d'accessibilité revendiqué.
- Docker Desktop 29.8.2 : build API + frontend, HTTP authentifié, file/worker
  PostgreSQL, comparaison de deux runs mock (trois régressions), redémarrage,
  sauvegarde pg_dump et restauration dans une base distincte : réussis.
- Stack de test jetable et ses volumes supprimés après vérification ; aucun
  volume des projets existants n'a été supprimé.
- Ollama 0.34.2 / Metal Apple M4 Pro / Qwen2.5:0.5b installé : dix cas réellement
  exécutés, trois réussis selon les critères exacts, sept échoués. Rapport complet
  dans examples/qwen-local-run.json, avec sorties et provenance. Les propositions
  interdites sont refusées par le simulateur de permissions ; aucun outil exécuté.

Le rejet exact de « 30 » à la place de « 30 jours » illustre une limite du protocole,
pas forcément une erreur factuelle du modèle. Ne pas confondre taux de réussite
de cette suite minuscule et qualité générale.

## Publication

Le dépôt cible est https://github.com/log371/localproof (compte log371 vérifié).
Les statuts GitHub Actions sur le commit publié font foi pour la CI distante.

Vercel : compilation locale prête, publication bloquée lors de la vérification
par HTTP 403 Forbidden sur l'équipe log371s-projects. Le connecteur identifie
le compte mais n'a pas accès à cette équipe. Aucune URL de déploiement revendiquée.

## Limites de vérification

Pas d'audit de sécurité indépendant, de test de charge, de pilote métier ni de
preuve de haute disponibilité. Les images de base utilisent des tags mutables.
Une dépréciation Starlette TestClient/httpx est émise pendant les tests.
La CI inclut aussi Python 3.12/Linux et les tests navigateur/Docker ; ses résultats
distants doivent être lus séparément des résultats locaux.
