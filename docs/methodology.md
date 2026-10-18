# Protocole v0.1

LocalProof est un banc d'essai de développement, pas une certification ni une
mesure universelle de qualité. Les dix cas fictifs français couvrent trois suites :

- RAG : recherche lexicale sur trois documents, réponse courte exacte, citation
  disponible dans les passages récupérés, abstention sur une information absente.
- Extraction : égalité stricte de trois champs JSON, types compris. Zéro n'est
  pas traité comme une valeur manquante ; un booléen n'est pas un entier.
- Permissions : quatre propositions JSON et décision déterministe simulée.
  Aucun shell, outil, fichier ou appel réseau proposé par le modèle n'est exécuté.

Une bonne paraphrase peut échouer au contrôle exact. Une citation existante ne
prouve pas que tout le texte est étayé. Le retriever est une baseline lexicale,
pas un moteur sémantique. La suite ne mesure pas un RAG tiers de bout en bout.
Les attaques ne sont ni exhaustives ni représentatives. Un refus par le garde-fou
ne signifie pas que le modèle lui-même a résisté : la sortie et les contrôles
restent visibles séparément.

## Reproductibilité

Chaque rapport inclut hash de la suite, version de l'application, configuration,
seed, température, top-k, hash des prompts, sources, champs attendus et observés,
version du runtime et digest du manifeste Ollama observé avant/après l'exécution.
Le digest du manifeste n'est pas un recalcul indépendant des poids. Les erreurs
ne sont jamais converties en succès. La latence client inclut éventuellement le
chargement du modèle ; ce n'est pas un débit GPU comparable entre matériels.
Le système et l'architecture CPU sont relevés, pas la RAM/GPU ni l'énergie.
Seed et température n'assurent pas un résultat déterministe entre runtimes.

La comparaison exige une suite identique, les mêmes identifiants de cas et la
même provenance simulée/réelle. Elle signale les passages réussite → échec.
Elle ne produit ni p-value ni conclusion statistique à partir de dix exemples.
Un protocole sérieux pour un usage métier nécessite un corpus indépendant,
des annotations revues, des répétitions et une analyse des erreurs.

## Démonstration publique

Les données embarquées dans l'interface sont illustratives, sans aucune mesure
de modèle réel. Le mock du runner lit les valeurs attendues : il vérifie la
plomberie du système, jamais l'intelligence d'un modèle. Un import JSON est
validé structurellement, pas authentifié ou signé. L'utilisateur peut falsifier
son contenu ; « provenance déclarée » n'est donc pas une attestation.

Les rapports importés restent en mémoire du navigateur et ne sont pas envoyés
par l'application. Aucun analytics, SDK IA cloud, police distante ou tracker
n'est requis. L'hébergeur reste susceptible de journaliser les requêtes HTTP.
