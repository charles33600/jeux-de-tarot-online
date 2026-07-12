# 🃏 Tarot en ligne

Jeu de **Tarot français** multijoueur en ligne : créez une table, partagez son
code à 6 caractères, et jouez à 3, 4 ou 5 — entre humains, ou en complétant la
table avec des **bots IA**. Aucun compte, aucun mot de passe : un pseudo suffit.

## Lancer le jeu

```bash
npm install
npm start
```

Puis ouvrez [http://localhost:3000](http://localhost:3000). Pour jouer à
plusieurs sur la même machine, utilisez plusieurs fenêtres de navigation
privée (chaque fenêtre a sa propre session).

## Mettre le jeu en ligne (gratuit)

⚠️ GitHub Pages ne convient pas : il n'héberge que des fichiers statiques,
or le jeu a besoin d'un serveur Node.js permanent (parties, bots, temps
réel Socket.IO). Utilisez plutôt un hébergeur d'applications gratuit :

**Render** (recommandé, config fournie dans `render.yaml`) :

1. Créez un compte gratuit sur [render.com](https://render.com) (connexion
   possible avec votre compte GitHub).
2. Cliquez sur **New → Blueprint**, choisissez ce dépôt, validez.
3. Render construit et démarre le jeu, puis vous donne une adresse publique
   du type `https://jeux-de-tarot-online.onrender.com` — partagez-la avec
   vos amis, chacun crée/rejoint une table avec le code à 6 lettres.

Alternatives équivalentes : [Railway](https://railway.app),
[Fly.io](https://fly.io), [Glitch](https://glitch.com) (importer le dépôt,
`npm start` est détecté automatiquement).

Notes sur l'offre gratuite de Render : le serveur s'endort après ~15 min
sans visite (la première connexion suivante prend ~30 s pour le réveiller)
et l'état étant en mémoire, un redémarrage ferme les tables en cours.

## Fonctionnalités

- **Tables par code aléatoire** (6 caractères), sans inscription.
- **3, 4 ou 5 joueurs** (variantes officielles), de 1 humain + IA jusqu'à
  une table 100 % humaine — l'hôte ajoute des bots pour compléter.
- **Règles complètes (style FFT)** :
  - enchères : Petite, Garde, Garde sans le chien, Garde contre le chien ;
  - chien et écart (ni roi ni bout ; atout seulement si forcé, alors montré) ;
  - à 5 joueurs : appel du roi, partenaire secret jusqu'à la carte jouée ;
  - obligations de fournir, couper, **monter à l'atout** ;
  - Excuse (ne prend jamais le pli, reste à son camp contre une basse carte,
    capturée au dernier pli sauf chelem) ;
  - Petit au bout, poignées (simple/double/triple), chelem ;
  - comptage officiel : cibles 56/51/41/36, `(25 + écart) × 1/2/4/6`,
    scores à somme nulle, tableau cumulé sur plusieurs donnes.
- **Reconnexion automatique** : rechargez la page, vous reprenez votre place.
  Un joueur absent plus de 90 s est remplacé par un bot — et récupère son
  siège dès son retour.
- **Bots heuristiques** : évaluation de main pour les enchères, écart qui
  crée des coupes, chasse au Petit, défense qui charge les plis de son camp.

## Choix d'implémentation

- Node.js + Express + Socket.IO ; état en mémoire (pas de base de données).
- Frontend vanilla (modules ES) sans étape de build ; cartes dessinées en CSS.
- Le moteur de règles (`shared/`) est **partagé** entre le serveur, les bots,
  les tests et le navigateur.
- Le serveur est autoritaire : chaque client ne reçoit que sa main et l'état
  public ; tous les coups sont validés côté serveur.
- Simplification assumée : après un « tout le monde passe », les cartes sont
  rebattues (au lieu de recouper le même paquet).

## Tests

```bash
npm test          # tests unitaires du moteur de règles (node:test)
npm run simulate  # parties complètes 100 % bots à 3/4/5 joueurs + invariants
```

La simulation vérifie, sur des centaines de donnes : conservation des
78 cartes, total de 91 points, scores à somme nulle, dette d'Excuse soldée,
aucune action illégale.

## Structure

```
shared/   moteur de règles pur (cartes, donne, enchères, jeu, poignées, scores)
server/   Express + Socket.IO, orchestrateur de table, vues expurgées, bots
public/   interface (accueil, lobby, table de jeu) — français, responsive
test/     tests unitaires + simulation de bout en bout
```
