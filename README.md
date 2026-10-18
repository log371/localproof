# LocalProof

**Des preuves, pas des promesses.** Un banc d'essai open source, local-first,
pour comparer de petites configurations IA et inspecter leurs régressions.

Statut : v0.1 expérimentale. Pas une certification de sécurité, pas un produit
multi-tenant. Les résultats de démonstration sont simulés et explicitement étiquetés.

## Ce que fait cette version

- Crash-test JSON dans le navigateur : types modifiés, champs absents/inventés,
  valeurs différentes, chemins JSON Pointer et diagnostic Markdown exportable.
  Utilisable immédiatement sans serveur IA, compte ou clé API.
- 10 cas fictifs : RAG avec citations, extraction JSON, permissions/injections simulées.
- Ollama local ou mock déterministe ; paramètres et provenance conservés.
- FastAPI + file durable SQLAlchemy/PostgreSQL, worker avec reprise par cas.
- Interface Next.js : comparaison, filtres, inspecteur, import/export JSON.
- Démo statique déployable sur Vercel, sans connexion au lab ni secret.
- Installation complète Docker Compose, tests Pytest et Playwright, CI GitHub.

## Démarrage rapide sans modèle (Python 3.12+ et uv)

```sh
git clone https://github.com/log371/localproof.git
cd localproof
uv sync --frozen
uv run localproof run --provider mock --model demo-reference
uv run localproof worker --once
uv run localproof run --provider mock --model demo-regression
uv run localproof worker --once
uv run localproof list
uv run localproof compare ID_REFERENCE ID_CANDIDAT
uv run localproof export ID_CANDIDAT > rapport.json
```

SQLite est le mode CLI de développement par défaut. Importez rapport.json dans
l'interface : aucun envoi de son contenu n'est effectué par l'application.
Le mock doit produire trois régressions volontaires, pas un score de modèle réel.

## Interface seule (Node 24)

```sh
cd web
npm ci
npm run build
python3 -m http.server 3010 --bind 127.0.0.1 --directory out
```

Ouvrir http://127.0.0.1:3010. Ce mode sert la démo et les imports, pas /api.

## Installation complète

Créez `.env` d'après `.env.example` et générez **deux secrets distincts** :

```sh
python3 -c 'import secrets; print(secrets.token_hex(32))'
docker compose up --build -d
```

Renseignez chaque valeur dans .env, sans la publier. Ouvrez http://127.0.0.1:3080.
La section « Connecter mon installation locale » permet de saisir le jeton,
le nom exact d'un modèle déjà installé, puis de lancer/actualiser les runs.
Le worker doit pouvoir joindre Ollama sur host.docker.internal:11434.
Sur Linux, le service host doit écouter sur une interface accessible au bridge
Docker avec filtrage réseau ; ne publiez pas Ollama sur Internet. Pour éviter
cette configuration, exécutez le worker en natif avec une base accessible de
façon privée et OLLAMA_URL=http://127.0.0.1:11434.

Le téléchargement de modèles n'est jamais automatique. Vérifiez la licence du
modèle choisi et la mémoire disponible. Aucun poids n'est inclus dans ce dépôt.

## Exécution Ollama native

```sh
ollama list
uv run localproof run --provider ollama --model NOM_EXACT:TAG
uv run localproof worker --once
```

Le worker vérifie que le modèle existe dans /api/tags. Vous pouvez changer
OLLAMA_URL pour une origine locale autorisée, pas via une requête utilisateur.

## Déployer la démo Vercel

Importer `log371/localproof`, sélectionner **Root Directory = web**, framework
Next.js et la commande npm run build. Aucune variable secrète ni base distante.
Vérifier le preview avant promotion. Le code MIT reste hébergeable sans Vercel.
Le statut effectif de publication est consigné dans docs/validation.md.

## Développement

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest --cov=localproof
cd web
npm ci
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Consulter [le protocole](docs/methodology.md), [l'exploitation](docs/operations.md)
et [les vérifications réellement effectuées](docs/validation.md).

Un [rapport réel Qwen2.5 0.5B](examples/qwen-local-run.json) est inclus : 3/10
sur ce petit protocole exact, avec les échecs conservés. Importez-le dans la page
pour inspecter les sorties. Ce résultat isolé ne permet pas de classer les modèles.

## Licence et contribution

Code et jeux fictifs : MIT. Dépendances et runtimes conservent leurs licences
respectives ; les modèles ne sont pas couverts par notre licence. Les PR doivent
inclure tests et limites connues. Ne publiez ni jetons, ni documents privés, ni
rapports sensibles dans une issue. Aucun audit de sécurité indépendant revendiqué.
