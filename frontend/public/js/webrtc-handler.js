// Gestionnaire WebRTC pour AudioExchange
class WebRTCHandler {
    constructor() {
        this.localStream = null; // Flux média local
        this.remoteStream = null; // Flux média distant
        this.peerConnection = null; // Connexion WebRTC
        this.socket = null; // Connexion Socket.IO
        this.roomId = null; // ID de la salle
        this.username = null; // Nom d'utilisateur
        this.isTeacher = false; // Indique si l'utilisateur est un enseignant
        this.participants = {}; // Liste des participants
        this.videoEnabled = true; // État de la vidéo
        this.audioEnabled = true; // État de l'audio
        this.isScreenSharing = false; // État du partage d'écran

        // Configuration ICE (STUN/TURN)
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:votre-serveur-turn:3478',
                    username: 'turnuser',
                    credential: 'turnpassword'
                }
            ]
        };

        // Callbacks pour les événements
        this.callbacks = {
            onLocalStream: null, // Callback pour le flux local
            onRemoteStream: null, // Callback pour le flux distant
            onRemoteDisconnect: null, // Callback pour la déconnexion d'un participant
            onError: null, // Callback pour les erreurs
            onParticipantUpdate: null, // Callback pour les mises à jour des participants
            onPermissionChange: null // Callback pour les changements de permission
        };
    }

    /**
     * Initialiser le gestionnaire WebRTC
     * @param {Object} options - Options d'initialisation
     */
    initialize(options) {
        this.roomId = options.roomId;
        this.username = options.username;
        this.isTeacher = options.isTeacher || false;

        // Configurer les callbacks
        this.callbacks = {
            onLocalStream: options.onLocalStream || (() => {}),
            onRemoteStream: options.onRemoteStream || (() => {}),
            onRemoteDisconnect: options.onRemoteDisconnect || (() => {}),
            onError: options.onError || (() => {}),
            onParticipantUpdate: options.onParticipantUpdate || (() => {}),
            onPermissionChange: options.onPermissionChange || (() => {})
        };

        // Connexion au serveur de signalisation
        this.socket = io.connect('http://localhost:3000', {
            forceNew: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        // Configurer les événements Socket.IO
        this.setupSocketEvents();

        // Démarrer le flux média local
        this.getLocalMedia(this.isTeacher);
    }

    /**
     * Configurer les événements Socket.IO
     */
    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connecté au serveur de signalisation');

            // Rejoindre la salle
            this.socket.emit('join-room', {
                roomId: this.roomId,
                username: this.username,
                isTeacher: this.isTeacher,
                capabilities: {
                    video: true,
                    audio: true,
                    screen: true
                }
            });
        });

        this.socket.on('room-joined', (data) => {
            console.log('Salle rejointe:', data);

            // Mettre à jour la liste des participants
            if (data.participants && data.participants.length > 0) {
                data.participants.forEach(participant => {
                    this.participants[participant.socketId] = participant;
                });

                // Notifier l'UI de la liste des participants
                this.callbacks.onParticipantUpdate(this.participants);

                // Créer des connexions avec les participants existants
                data.participants.forEach(participant => {
                    if (participant.socketId !== this.socket.id) {
                        this.createPeerConnection(participant.socketId);
                        this.sendOffer(participant.socketId);
                    }
                });
            }
        });

        this.socket.on('user-joined', (data) => {
            console.log('Nouvel utilisateur:', data);

            // Ajouter le participant à la liste
            this.participants[data.socketId] = data;

            // Notifier l'UI
            this.callbacks.onParticipantUpdate(this.participants);

            // Créer une connexion avec le nouvel utilisateur
            this.createPeerConnection(data.socketId);
        });

        this.socket.on('user-left', (data) => {
            console.log('Utilisateur parti:', data);

            // Nettoyer la connexion
            if (this.peerConnections[data.socketId]) {
                this.peerConnections[data.socketId].close();
                delete this.peerConnections[data.socketId];
            }

            // Retirer le participant de la liste
            delete this.participants[data.socketId];

            // Notifier l'UI
            this.callbacks.onRemoteDisconnect(data.socketId);
            this.callbacks.onParticipantUpdate(this.participants);
        });

        this.socket.on('webrtc-signal', (data) => {
            console.log('Signal WebRTC reçu:', data);

            const { from, signal } = data;

            // Créer une connexion si elle n'existe pas
            if (!this.peerConnections[from]) {
                this.createPeerConnection(from);
            }

            // Traiter le signal WebRTC
            if (signal.type === 'offer') {
                this.handleOffer(from, signal);
            } else if (signal.type === 'answer') {
                this.handleAnswer(from, signal);
            } else if (signal.candidate) {
                this.handleCandidate(from, signal);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Erreur de connexion au serveur:', error);
            this.callbacks.onError(new Error('Erreur de connexion au serveur de signalisation'));
        });
    }

    /**
     * Créer une connexion WebRTC
     * @param {string} socketId - ID du socket du participant
     */
    createPeerConnection(socketId) {
        try {
            const pc = new RTCPeerConnection(this.config);

            // Ajouter le flux local à la connexion
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream);
                });
            }

            // Gérer les candidats ICE
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc-signal', {
                        roomId: this.roomId,
                        target: socketId,
                        signal: event.candidate
                    });
                }
            };

            // Gérer le flux distant
            pc.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.callbacks.onRemoteStream(this.remoteStream, socketId);
            };

            // Stocker la connexion
            this.peerConnections[socketId] = pc;
        } catch (error) {
            console.error('Erreur de création de connexion WebRTC:', error);
            this.callbacks.onError(new Error('Erreur de création de connexion WebRTC'));
        }
    }

    /**
     * Envoyer une offre WebRTC
     * @param {string} socketId - ID du socket du participant
     */
    async sendOffer(socketId) {
        try {
            const pc = this.peerConnections[socketId];
            if (!pc) return;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            this.socket.emit('webrtc-signal', {
                roomId: this.roomId,
                target: socketId,
                signal: pc.localDescription
            });
        } catch (error) {
            console.error('Erreur lors de l\'envoi de l\'offre:', error);
            this.callbacks.onError(new Error('Erreur lors de l\'envoi de l\'offre'));
        }
    }

    /**
     * Gérer une offre WebRTC reçue
     * @param {string} socketId - ID du socket du participant
     * @param {Object} offer - Offre WebRTC
     */
    async handleOffer(socketId, offer) {
        try {
            const pc = this.peerConnections[socketId];
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.socket.emit('webrtc-signal', {
                roomId: this.roomId,
                target: socketId,
                signal: pc.localDescription
            });
        } catch (error) {
            console.error('Erreur lors de la gestion de l\'offre:', error);
            this.callbacks.onError(new Error('Erreur lors de la gestion de l\'offre'));
        }
    }

    /**
     * Gérer une réponse WebRTC reçue
     * @param {string} socketId - ID du socket du participant
     * @param {Object} answer - Réponse WebRTC
     */
    async handleAnswer(socketId, answer) {
        try {
            const pc = this.peerConnections[socketId];
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Erreur lors de la gestion de la réponse:', error);
            this.callbacks.onError(new Error('Erreur lors de la gestion de la réponse'));
        }
    }

    /**
     * Gérer un candidat ICE reçu
     * @param {string} socketId - ID du socket du participant
     * @param {Object} candidate - Candidat ICE
     */
    async handleCandidate(socketId, candidate) {
        try {
            const pc = this.peerConnections[socketId];
            if (!pc) return;

            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Erreur lors de l\'ajout du candidat ICE:', error);
            this.callbacks.onError(new Error('Erreur lors de l\'ajout du candidat ICE'));
        }
    }

    /**
     * Nettoyer les ressources
     */
    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        if (this.peerConnections) {
            Object.values(this.peerConnections).forEach(pc => pc.close());
            this.peerConnections = {};
        }

        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Exporter l'instance
export default new WebRTCHandler();