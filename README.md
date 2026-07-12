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
