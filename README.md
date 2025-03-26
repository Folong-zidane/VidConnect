# AudioExchange

AudioExchange est une application de visioconférence inspirée de Google Meet, spécialement conçue pour les contextes éducatifs avec une distinction claire entre enseignants et étudiants.

## Technologies utilisées

- **Frontend** :
  - HTML5, CSS3, JavaScript (ES6+)
  - Interface responsive adaptée à tous les appareils
  - Font Awesome pour les icônes
  - Google Fonts (Roboto) pour une typographie moderne

- **Backend** :
  - Node.js avec Express.js pour le serveur
  - Socket.IO pour la signalisation en temps réel
  - WebRTC pour les communications audio/vidéo peer-to-peer

- **Protocoles de communication** :
  - WebRTC (Web Real-Time Communication) pour les flux audio/vidéo directs
  - ICE (Interactive Connectivity Establishment) avec serveurs STUN pour la traversée NAT
  - WebSockets via Socket.IO pour la signalisation

## Caractéristiques principales

### Gestion des rôles

- **Enseignant (Teacher)** :
  - Créateur et administrateur de la salle
  - Caméra et microphone activés par défaut
  - Contrôle des flux audio/vidéo des participants
  - Gestion des demandes de prise de parole
  - Possibilité de bloquer/débloquer les flux des participants

- **Étudiant (User)** :
  - Microphone seul activé par défaut (caméra désactivée)
  - Système de "lever la main" pour demander la parole
  - Flux vidéo activable uniquement avec l'autorisation de l'enseignant

### Interface adaptative

- Disposition dynamique des participants :
  - Vue principale pour l'enseignant
  - Vue personnelle pour l'utilisateur actuel
  - Grille redimensionnable pour les autres participants
  - Possibilité de masquer/afficher certains flux vidéo
  - Défilement horizontal pour visualiser tous les participants

### Optimisation des ressources

- Gestion intelligente de la bande passante :
  - Flux vidéo des étudiants désactivés par défaut
  - Qualité vidéo adaptative selon la connexion
  - Options de résolution configurables (480p, 720p, 1080p)

### Fonctionnalités supplémentaires

- Chat textuel intégré
- Partage d'écran
- Sélection des périphériques (caméra, micro, sortie audio)
- Indicateur visuel des participants qui parlent
- Système de notifications pour les demandes de parole
- Statistiques de connexion en temps réel

## Installation et déploiement

```bash
# Cloner le dépôt
git clone https://github.com/folong-zidane/VidConnect.git
cd audioexchange

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Construire pour la production
npm run build
npm start
```

## Architecture de communication

1. **Établissement de la connexion** :
   - L'enseignant crée une salle et devient automatiquement l'administrateur
   - Les étudiants rejoignent via un lien ou un code de salle
   - Le serveur Socket.IO gère les entrées/sorties et notifie tous les participants

2. **Échange de signaux WebRTC** :
   - Processus d'offre/réponse SDP (Session Description Protocol)
   - Échange de candidats ICE via Socket.IO
   - Établissement de connexions P2P entre tous les participants

3. **Gestion des flux média** :
   - L'enseignant diffuse automatiquement son flux audio/vidéo
   - Les étudiants diffusent uniquement leur audio par défaut
   - Les autorisations de diffusion vidéo sont gérées par l'enseignant

## Avantages du système

- **Faible latence** grâce aux connexions P2P via WebRTC
- **Réduction de la consommation de bande passante** avec l'activation sélective des flux
- **Interface inspirée de Google Meet** pour une prise en main intuitive
- **Système de rôles** adapté au contexte éducatif
- **Architecture évolutive** supportant jusqu'à 100 participants par salle

## Développement futur

- Intégration d'un système d'enregistrement des sessions
- Tableau blanc collaboratif
- Sondages et quiz intégrés
- Traduction automatique des messages du chat
- Reconnaissance des gestes pour lever la main
