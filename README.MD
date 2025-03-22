/audio-exchange-app/
│
├── frontend/                          # Application client
│   ├── public/                        # Fichiers statiques
│   │   ├── index.html                 
│   │   ├── lobby.html
│   │   ├── css/
│   │   │   ├── main.css
│   │   │   └── lobby.css
│   │   └── js/
│   │       ├── main.js                # Code principal
│   │       ├── webrtc-handler.js      # Gestion de WebRTC
│   │       └── ui.js                  # Interface utilisateur
│   │
│   └── package.json                   # Dépendances frontend
│
├── signaling-server/                  # Serveur de signalisation
│   ├── server.js                      # Point d'entrée principal
│   ├── lib/
│   │   ├── socket-handler.js          # Gestion des WebSockets
│   │   ├── room-manager.js            # Gestion des salles
│   │   └── auth.js                    # Authentification
│   │
│   └── package.json                   # Dépendances serveur
│
├── media-server/                      # Configuration Janus
│   ├── janus.cfg                      # Configuration principale
│   ├── janus.plugin.videoroom.jcfg    # Config plugin videoroom
│   └── janus.transport.http.jcfg      # Config transport HTTP
│
├── turn-server/                       # Configuration coturn
│   └── turnserver.conf                # Configuration coturn
│
├── nginx/                             # Configuration Nginx
│   └── nginx.conf                     # Config load balancer
│
├── monitoring/                        # Configurations monitoring
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
│           └── webrtc-dashboard.json
│
└── deploy/                            # Scripts de déploiement
    ├── docker-compose.yml             # Configuration Docker
    ├── setup.sh                       # Script d'installation
    └── .env                           # Variables d'environnement



    Je vais vous présenter une architecture complète pour votre application auto-hébergée de streaming vidéo/audio en temps réel. Voici la structure du projet et les procédures d'installation.

# Architecture de l'application de streaming auto-hébergée

## Structure du projet

```
/audio-exchange-app/
│
├── frontend/                          # Application client
│   ├── public/                        # Fichiers statiques
│   │   ├── index.html                 
│   │   ├── lobby.html
│   │   ├── css/
│   │   │   ├── main.css
│   │   │   └── lobby.css
│   │   └── js/
│   │       ├── main.js                # Code principal
│   │       ├── webrtc-handler.js      # Gestion de WebRTC
│   │       └── ui.js                  # Interface utilisateur
│   │
│   └── package.json                   # Dépendances frontend
│
├── signaling-server/                  # Serveur de signalisation
│   ├── server.js                      # Point d'entrée principal
│   ├── lib/
│   │   ├── socket-handler.js          # Gestion des WebSockets
│   │   ├── room-manager.js            # Gestion des salles
│   │   └── auth.js                    # Authentification
│   │
│   └── package.json                   # Dépendances serveur
│
├── media-server/                      # Configuration Janus
│   ├── janus.cfg                      # Configuration principale
│   ├── janus.plugin.videoroom.jcfg    # Config plugin videoroom
│   └── janus.transport.http.jcfg      # Config transport HTTP
│
├── turn-server/                       # Configuration coturn
│   └── turnserver.conf                # Configuration coturn
│
├── nginx/                             # Configuration Nginx
│   └── nginx.conf                     # Config load balancer
│
├── monitoring/                        # Configurations monitoring
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
│           └── webrtc-dashboard.json
│
└── deploy/                            # Scripts de déploiement
    ├── docker-compose.yml             # Configuration Docker
    ├── setup.sh                       # Script d'installation
    └── .env                           # Variables d'environnement
```

## Mise en œuvre des composants principaux

### 1. Frontend (WebRTC)

Le frontend sera responsable de l'interface utilisateur et de la gestion des connexions WebRTC.

```javascript
// frontend/public/js/webrtc-handler.js

class WebRTCHandler {
  constructor(socketClient) {
    this.socket = socketClient;
    this.peerConnections = {};
    this.localStream = null;
    this.roomId = null;
    
    // Configuration ICE avec serveurs STUN/TURN
    this.iceServers = {
      iceServers: [
        { urls: "stun:stun.votre-domaine.com:3478" },
        {
          urls: "turn:turn.votre-domaine.com:3478",
          username: "turnuser",
          credential: "turnpassword"
        }
      ]
    };
    
    this.initSocketListeners();
  }
  
  // Initialisation des écouteurs de socket
  initSocketListeners() {
    this.socket.on("user-joined", this.handleUserJoined.bind(this));
    this.socket.on("offer", this.handleOffer.bind(this));
    this.socket.on("answer", this.handleAnswer.bind(this));
    this.socket.on("ice-candidate", this.handleIceCandidate.bind(this));
    this.socket.on("user-disconnected", this.handleUserDisconnected.bind(this));
  }
  
  // Démarrer le flux local (caméra et micro)
  async startLocalStream(constraints = { video: true, audio: true }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error("Erreur d'accès aux périphériques:", error);
      throw error;
    }
  }
  
  // Rejoindre une salle
  joinRoom(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    this.socket.emit("join-room", { roomId, userId });
  }
  
  // Création d'une connexion peer
  async createPeerConnection(userId) {
    try {
      const peerConnection = new RTCPeerConnection(this.iceServers);
      
      // Ajout des pistes locales
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
      
      // Gestion des candidats ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit("ice-candidate", {
            to: userId,
            candidate: event.candidate
          });
        }
      };
      
      // Gestion des pistes distantes
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        this.onTrackCallback && this.onTrackCallback(userId, remoteStream);
      };
      
      // Adaptation à la bande passante
      peerConnection.onconnectionstatechange = (event) => {
        if (peerConnection.connectionState === 'connected') {
          // Appliquer les paramètres de qualité adaptative
          this.applyBitrateSettings(peerConnection);
        }
      };
      
      this.peerConnections[userId] = peerConnection;
      return peerConnection;
    } catch (error) {
      console.error("Erreur de création de connexion:", error);
      throw error;
    }
  }
  
  // Initialisation d'une offre
  async initiateOffer(userId) {
    try {
      const peerConnection = await this.createPeerConnection(userId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.socket.emit("offer", {
        to: userId,
        offer: peerConnection.localDescription
      });
    } catch (error) {
      console.error("Erreur d'initiation d'offre:", error);
    }
  }
  
  // Gestion d'un utilisateur qui rejoint
  async handleUserJoined(data) {
    await this.initiateOffer(data.userId);
  }
  
  // Gestion d'une offre reçue
  async handleOffer(data) {
    try {
      const peerConnection = await this.createPeerConnection(data.from);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.socket.emit("answer", {
        to: data.from,
        answer: peerConnection.localDescription
      });
    } catch (error) {
      console.error("Erreur de traitement d'offre:", error);
    }
  }
  
  // Gestion d'une réponse
  async handleAnswer(data) {
    try {
      const peerConnection = this.peerConnections[data.from];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } catch (error) {
      console.error("Erreur de traitement de réponse:", error);
    }
  }
  
  // Gestion d'un candidat ICE
  async handleIceCandidate(data) {
    try {
      const peerConnection = this.peerConnections[data.from];
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error("Erreur d'ajout de candidat ICE:", error);
    }
  }
  
  // Gestion d'un utilisateur qui se déconnecte
  handleUserDisconnected(data) {
    if (this.peerConnections[data.userId]) {
      this.peerConnections[data.userId].close();
      delete this.peerConnections[data.userId];
    }
  }
  
  // Paramètres de qualité adaptative
  applyBitrateSettings(peerConnection) {
    const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) {
      const parameters = sender.getParameters();
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      
      // Configurer l'adaptation de débit
      parameters.encodings[0].maxBitrate = 1000000; // 1Mbps initial
      
      // Appliquer les paramètres
      sender.setParameters(parameters).catch(e => {
        console.error("Erreur d'application des paramètres de débit:", e);
      });
    }
  }
  
  // Callback pour les nouvelles pistes
  onTrack(callback) {
    this.onTrackCallback = callback;
  }
  
  // Fermeture de toutes les connexions
  closeAllConnections() {
    Object.keys(this.peerConnections).forEach(userId => {
      this.peerConnections[userId].close();
    });
    this.peerConnections = {};
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }
}

export default WebRTCHandler;
```

### 2. Serveur de signalisation (Node.js + Socket.IO)

```javascript
// signaling-server/server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const RoomManager = require('./lib/room-manager');
const { authenticateUser } = require('./lib/auth');
const { setupMetrics } = require('./lib/metrics');

// Initialisation
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuration des métriques Prometheus
const metrics = setupMetrics();

// Gestionnaire de salles
const roomManager = new RoomManager();

// Middleware d'authentification pour Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (authenticateUser(token)) {
    return next();
  }
  return next(new Error("Authentification échouée"));
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log(`Nouvelle connexion: ${socket.id}`);
  metrics.connectionsCounter.inc();
  
  let currentRoomId = null;
  let currentUserId = null;
  
  // Rejoindre une salle
  socket.on('join-room', ({ roomId, userId }) => {
    currentRoomId = roomId;
    currentUserId = userId || uuidv4();
    
    // Rejoindre la salle Socket.IO
    socket.join(roomId);
    
    // Ajouter l'utilisateur à la salle
    roomManager.addUserToRoom(roomId, currentUserId, socket.id);
    
    // Informer les autres utilisateurs de la salle
    socket.to(roomId).emit('user-joined', { userId: currentUserId });
    
    // Envoyer la liste des utilisateurs existants
    const usersInRoom = roomManager.getUsersInRoom(roomId).filter(user => user !== currentUserId);
    socket.emit('room-users', { users: usersInRoom });
    
    console.log(`Utilisateur ${currentUserId} a rejoint la salle ${roomId}`);
    metrics.roomsGauge.inc();
  });
  
  // Traitement des offres WebRTC
  socket.on('offer', ({ to, offer }) => {
    io.to(roomManager.getSocketId(to)).emit('offer', {
      from: currentUserId,
      offer
    });
    metrics.signalsCounter.inc({ type: 'offer' });
  });
  
  // Traitement des réponses WebRTC
  socket.on('answer', ({ to, answer }) => {
    io.to(roomManager.getSocketId(to)).emit('answer', {
      from: currentUserId,
      answer
    });
    metrics.signalsCounter.inc({ type: 'answer' });
  });
  
  // Traitement des candidats ICE
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(roomManager.getSocketId(to)).emit('ice-candidate', {
      from: currentUserId,
      candidate
    });
    metrics.signalsCounter.inc({ type: 'ice-candidate' });
  });
  
  // Gestion des déconnexions
  socket.on('disconnect', () => {
    console.log(`Déconnexion: ${socket.id}`);
    
    if (currentRoomId) {
      // Retirer l'utilisateur de la salle
      roomManager.removeUserFromRoom(currentRoomId, currentUserId);
      
      // Informer les autres utilisateurs
      socket.to(currentRoomId).emit('user-disconnected', { userId: currentUserId });
      
      metrics.roomsGauge.dec();
    }
    
    metrics.connectionsCounter.dec();
  });
});

// Route pour les métriques Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur de signalisation démarré sur le port ${PORT}`);
});

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log("Arrêt du serveur...");
  server.close(() => {
    console.log("Serveur arrêté");
    process.exit(0);
  });
});
```

### 3. Configuration de Janus Gateway

```ini
# media-server/janus.cfg

[general]
log_to_stdout = true
debug_level = 4

[media]
rtp_port_range = 10000-20000
dtls_mtu = 1200

[nat]
stun_server = stun.votre-domaine.com
stun_port = 3478
nice_debug = false
ice_lite = true
ice_tcp = true
full_trickle = true

[certificates]
cert_pem = /opt/janus/share/janus/certs/cert.pem
cert_key = /opt/janus/share/janus/certs/key.pem
```

```javascript
# media-server/janus.plugin.videoroom.jcfg

general: {
    events = true                # Activer les événements pour Prometheus
    admin_key = "janusoverlord"  # Clé pour les opérations administratives
}

room-1234: {
    description = "Salle de démonstration"
    secret = "roomsecret"
    publishers = 100          # Nombre maximum de diffuseurs
    bitrate = 1024000         # Débit maximal (1Mbps)
    fir_freq = 10             # Demande d'image complète tous les 10s
    audiocodec = "opus"
    videocodec = "vp9,h264"   # Prioriser VP9, puis H.264
    record = false
    notify_joining = true
}
```

### 4. Configuration du serveur TURN (coturn)

```
# turn-server/turnserver.conf

# Configuration réseau
listening-port=3478
tls-listening-port=5349
alt-listening-port=3479
alt-tls-listening-port=5350
listening-ip=VOTRE_IP_PUBLIQUE
external-ip=VOTRE_IP_PUBLIQUE

# Configuration d'authentification
fingerprint
lt-cred-mech
user=turnuser:turnpassword
realm=votre-domaine.com

# Configuration TLS
cert=/etc/turnserver/cert.pem
pkey=/etc/turnserver/key.pem

# Performance et sécurité
total-quota=100
stale-nonce=600
max-bps=3072000
prometheus
prometheus-port=9641

# Journalisation
verbose
```

### 5. Configuration de Nginx (Load Balancer)

```nginx
# nginx/nginx.conf

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 10000;     # Pour supporter 5000 utilisateurs
    multi_accept on;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Cache pour fichiers statiques
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=STATIC:10m inactive=24h max_size=1g;

    # Upstream pour serveurs de signalisation
    upstream signaling_servers {
        ip_hash;                      # Session persistence
        server signaling1:3000;
        server signaling2:3000;
        server signaling3:3000;
        keepalive 32;
    }

    # Upstream pour serveurs Janus
    upstream janus_servers {
        least_conn;                   # Équilibrage de charge par connexions
        server janus1:8088;
        server janus2:8088;
        server janus3:8088;
        keepalive 32;
    }

    # Configuration SSL commune
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Serveur frontend
    server {
        listen 80;
        listen [::]:80;
        server_name app.votre-domaine.com;
        
        # Redirection vers HTTPS
        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name app.votre-domaine.com;

        # Configuration SSL
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # En-têtes de sécurité
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options SAMEORIGIN;
        add_header X-XSS-Protection "1; mode=block";

        # Fichiers statiques
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
            
            # Cache des fichiers statiques
            location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 30d;
                add_header Cache-Control "public, no-transform";
                proxy_cache STATIC;
                proxy_ignore_headers Cache-Control;
                proxy_cache_valid 60m;
            }
        }

        # API de signalisation
        location /socket.io/ {
            proxy_pass http://signaling_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;    # Pour les longues connexions WebSocket
        }

        # API Janus
        location /janus/ {
            proxy_pass http://janus_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }
    }

    # Serveur métriques Prometheus
    server {
        listen 127.0.0.1:9913;
        
        location /metrics {
            stub_status on;
        }
    }
}

stream {
    # Configuration pour le trafic TURN
    upstream turn_servers {
        server turn1:3478;
        server turn2:3478;
    }

    server {
        listen 3478 udp;
        listen 3478;
        proxy_pass turn_servers;
        proxy_timeout 30s;
        proxy_connect_timeout 5s;
    }

    server {
        listen 5349 ssl;
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        proxy_pass turn_servers;
        proxy_timeout 30s;
        proxy_connect_timeout 5s;
    }
}
```

### 6. Configuration Docker Compose pour le déploiement

```yaml
# deploy/docker-compose.yml

version: '3.8'

services:
  # Frontend - Application client
  frontend:
    image: nginx:alpine
    volumes:
      - ../frontend/public:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    restart: unless-stopped
    depends_on:
      - signaling
    networks:
      - frontend-net

  # Serveurs de signalisation
  signaling:
    build:
      context: ../signaling-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
    networks:
      - frontend-net
      - backend-net

  # Serveurs Janus
  janus:
    image: canyan/janus-gateway:latest
    volumes:
      - ../media-server/janus.cfg:/opt/janus/etc/janus/janus.cfg
      - ../media-server/janus.plugin.videoroom.jcfg:/opt/janus/etc/janus/janus.plugin.videoroom.jcfg
      - ../media-server/janus.transport.http.jcfg:/opt/janus/etc/janus/janus.transport.http.jcfg
      - ./ssl:/opt/janus/share/janus/certs:ro
    ports:
      - "8088:8088"
      - "8089:8089"
      - "10000-10500:10000-10500/udp"
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
    networks:
      - backend-net

  # Serveur TURN
  coturn:
    image: coturn/coturn:latest
    volumes:
      - ../turn-server/turnserver.conf:/etc/turnserver.conf
      - ./ssl:/etc/turnserver:ro
    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "5349:5349"
      - "5349:5349/udp"
      - "49152-65535:49152-65535/udp"
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G
    networks:
      - backend-net

  # Nginx Load Balancer
  nginx:
    image: nginx:latest
    volumes:
      - ../nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
      - "3478:3478/udp"
    restart: unless-stopped
    depends_on:
      - frontend
      - signaling
      - janus
      - coturn
    networks:
      - frontend-net
      - backend-net

  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ../monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks:
      - monitoring-net

  # Grafana
  grafana:
    image: grafana/grafana:latest
    volumes:
      - ../monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
    networks:
      - monitoring-net

networks:
  frontend-net:
  backend-net:
  monitoring-net:

volumes:
  prometheus_data:
  grafana_data:
```

## Procédure d'installation et de déploiement local

### Prérequis

1. Docker et Docker Compose installés
2. Node.js et npm pour le développement local
3. OpenSSL pour générer des certificats SSL

### Étapes d'installation locale

1. **Cloner le projet** et créer la structure de dossiers

```bash
mkdir -p audio-exchange-app/{frontend/{public,src},signaling-server,media-server,turn-server,nginx,monitoring/{prometheus,grafana/dashboards},deploy}
cd audio-exchange-app
```

2. **Générer des certificats SSL** pour le développement local

```bash
mkdir -p deploy/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout deploy/ssl/key.pem -out deploy/ssl/cert.pem
```

3. **Configurer l'application frontend** (Node.js + WebRTC)

```bash
cd frontend
npm init -y
npm install --save socket.io-client
```

4. **Configurer le serveur de signalisation**

```bash
cd ../signaling-server
npm init -y
npm install --save express socket.io uuid prom-client cors
```

5. **Préparer les fichiers de configuration** pour Janus, coturn, Nginx, etc.

6. **Lancer l'environnement de développement local**

```bash
cd ../
docker-compose -f deploy/docker-compose.yml up -d
```

## Procédure de déploiement en production

### Prérequis pour la production

1. Serveurs Ubuntu 22.04 LTS (minimum recommandé: 3 serveurs)
2. Nom de domaine configuré avec des enregistrements DNS
3. Certificats SSL valides (Let's Encrypt ou commercial)

### Étapes de déploiement

1. **Préparer les serveurs** avec Docker et Docker Compose

```bash
ssh user@server1
sudo apt update && sudo apt upgrade -y
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

2. **Configurer le pare-feu** pour ouvrir les ports nécessaires

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 10000:20000/udp  # Range pour WebRTC
sudo ufw enable
```

3. **Cloner le projet** sur chaque serveur

```bash
git clone <votre-repo> /opt/audio-exchange-app
cd /opt/audio-exchange-app
```

4. **Obtenir des certificats SSL** (Let's Encrypt)

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d app.votre-domaine.com
sudo cp /etc/letsencrypt/live/app.votre-domaine.com/fullchain.pem deploy/ssl/cert.pem
sudo cp /etc/letsencrypt/live/app.votre-domaine.com/privkey.pem deploy/ssl/key.pem
```

5. **Configurer les variables d'environnement**

```bash
cat > deploy/.env << EOL
GRAFANA_PASSWORD=VotreMotDePasseSecurisé
JANUS_API_KEY=VotreCleSécurisée
TURNSERVER_SECRET=AutreCleSécurisée
EOL
```

6. **Déployer avec Docker Compose**

```bash
cd /opt/audio-exchange-app
docker-compose -f deploy/docker-compose.yml up -d
```

7. **Vérifier le fonctionnement**

```bash
docker-compose -f deploy/docker-compose.yml ps
```

## Optimisations et problèmes courants

### Optimisation des performances

1. **Adaptation de la qualité vidéo** : Le frontend implémente l'adaptation automatique de la qualité selon la bande passante.

2. **Configuration du serveur** : Pour gérer 5000 utilisateurs simultanés :
   - Augmenter `worker_connections