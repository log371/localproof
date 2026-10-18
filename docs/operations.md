# Exploitation et limites

## Frontières

Le site Vercel est un export Next.js statique. Il ne contient aucun jeton, endpoint
du lab ou accès au moteur. Docker sert le même export et ajoute /api via Nginx.
Le port publié est limité à 127.0.0.1:3080 ; PostgreSQL et FastAPI ne sont pas publiés.
Le jeton API est obligatoire (32 caractères minimum), comparé en temps constant,
et saisi dans la page locale sans persistance navigateur. Pas de CORS permissif.
N'utilisez pas cette authentification mono-utilisateur comme système multi-tenant.
TLS, SSO, quotas et protection réseau sont nécessaires avant exposition distante.

Le worker joint uniquement l'origine Ollama configurée par l'administrateur,
validée par liste de noms locaux. Pas de redirection ni de proxy hérité de
l'environnement. Ce contrôle n'est pas une isolation réseau matérielle : un
administrateur peut modifier DNS, images, code ou environnement. Le réseau
inference a une sortie réseau ; le déploiement n'est pas certifié air-gapped.
Le runtime choisi peut avoir ses propres capacités cloud : utilisez un modèle
réellement installé et désactivez les fonctions cloud du runtime séparément.

## File durable

POST /runs persiste un travail, puis répond 202. Un worker réclame le travail
avec compare-and-swap et bail de dix minutes. Chaque cas est sauvegardé avant
le suivant. Après crash, un worker reprend les cas non persistés une fois le
bail expiré. Une inférence interrompue peut être répétée : traitement at-least-once,
pas exactly-once. Aucun effet externe métier n'est exécuté.
Le timeout HTTP est de 120 secondes par phase d'E/S, pas un délai mural absolu.
Une réponse extrêmement lente peut dépasser le bail ; l'ancien worker ne peut
plus sauvegarder après reprise par un nouveau propriétaire. V0.1 vise un worker.

Les erreurs de cas rendent le cas échoué ; « completed » signifie que le protocole
a fini, pas qu'il a réussi. Une erreur d'initialisation/version rend le run failed.
Relancez un nouveau run après correction, plutôt que modifier un rapport historique.

## Sauvegarde / restauration

Depuis la racine du dépôt, après création d'un répertoire privé de sauvegarde :

```sh
docker compose exec -T db pg_dump -U localproof -d localproof -Fc > backup.dump
```

Testez la restauration sur une base distincte, jamais en écrasant la production :

```sh
docker compose exec -T db createdb -U localproof localproof_restore
docker compose exec -T db pg_restore -U localproof -d localproof_restore < backup.dump
docker compose exec -T db psql -U localproof -d localproof_restore -c 'SELECT count(*) FROM runs_v1;'
```

Protégez les rapports et sauvegardes : les sorties de modèle peuvent contenir des
données sensibles. Pas de suppression automatique ni chiffrement applicatif.

## Mise à jour

Les bibliothèques sont verrouillées par uv.lock/package-lock.json. Les tags des
images Docker sont versionnés mais restent mutables : ne pas revendiquer un build
bit-à-bit reproductible. Pour un environnement contrôlé, consignez leurs digests.
Sauvegardez, reconstruisez, lancez les tests sur une copie de base, puis remplacez
la version. Schéma initial runs_v1 créé avec SQLAlchemy ; pas de migration destructive
automatique. Toute évolution de schéma doit livrer une migration explicite avant
de promettre la compatibilité. Rollback applicatif uniquement si schéma compatible.

Sans connexion, préparer images et dépendances sur une machine de confiance,
exporter/importer les images par docker save/load et contrôler leurs empreintes.
Une installation offline depuis une machine vierge n'est pas automatisée en v0.1.
