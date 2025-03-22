const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');

// Importer les modules personnalisés
const socketHandler = require('./lib/socket-handler');
const roomManager = require('./lib/room-manager');

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_FORMAT = NODE_ENV === 'production' ? 'combined' : 'dev';

// Création du dossier logs s'il n'existe pas
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Flux de log
const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'), 
    { flags: 'a' }
);

// Initialiser l'application Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000, // Augmenter le timeout pour les connexions longues
    maxHttpBufferSize: 5e6 // 5MB pour permettre le transfert de fichiers plus grands
});

// Middlewares
if (NODE_ENV === 'production') {
    app.use(helmet()); // Sécurité HTTP headers
}
app.use(cors());
app.use(compression()); // Compresser les réponses
app.use(express.json({ limit: '5mb' })); // Parser les requêtes JSON
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan(LOG_FORMAT, { stream: accessLogStream })); // Logging HTTP

// Middleware pour configurer les en-têtes CSP
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;"
  );
  next();
});

// Servir les fichiers statiques avec cache en production
if (NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/public'), {
        maxAge: '1d', // Cache client d'un jour
        etag: true,
        lastModified: true
    }));
} else {
    app.use(express.static(path.join(__dirname, '../frontend/public')));
}

// Routes API
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/rooms', (req, res) => {
    const publicRooms = roomManager.getPublicRooms();
    res.json({ rooms: publicRooms });
});

app.get('/api/room/:roomId/stats', (req, res) => {
    const { roomId } = req.params;
    const stats = roomManager.getRoomStats(roomId);
    
    if (!stats) {
        return res.status(404).json({ error: "Salle non trouvée" });
    }
    
    res.json({ stats });
});

// Routes frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/lobby.html'));
});

app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Middleware pour les 404
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, '../frontend/public/404.html'));
});

// Middleware pour les erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, '../frontend/public/500.html'));
});

// Initialiser le gestionnaire de sockets
socketHandler.initialize(io, roomManager);

// Démarrer le serveur
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT} en mode ${NODE_ENV}`);
    console.log(`API disponible sur http://localhost:${PORT}/api/health`);
    console.log(`UI disponible sur http://localhost:${PORT}`);
});

module.exports = server; // Pour les tests