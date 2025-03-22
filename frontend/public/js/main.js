document.addEventListener('DOMContentLoaded', () => {
    // Récupérer les paramètres de l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    const username = urlParams.get('username') || localStorage.getItem('username') || 'Utilisateur';

    // Rediriger vers le lobby si aucun ID de salle n'est fourni
    if (!roomId) {
        window.location.href = 'lobby.html';
        return;
    }

    // Afficher l'ID de la salle
    UI.setRoomId(roomId);
    UI.updateConnectionStatus('En attente d\'un participant...', 'waiting');

    // Sauvegarder le nom d'utilisateur dans localStorage pour une utilisation future
    if (username) {
        localStorage.setItem('username', username);
    }

    // Éléments DOM
    const micBtn = document.getElementById('mic-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const screenBtn = document.getElementById('screen-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const leaveBtn = document.getElementById('leave-btn');

    // États de la vidéo et de l'audio
    let isVideoEnabled = true;
    let isAudioEnabled = true;
    let isScreenSharing = false;

    // Initialiser WebRTC
    try {
        WebRTCHandler.initialize({
            roomId,
            username,
            onLocalStream: (stream) => {
                const localVideo = document.getElementById('local-video');
                if (localVideo) {
                    localVideo.srcObject = stream;
                }
            },
            onRemoteStream: (stream, socketId, participant) => {
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                    UI.showRemoteVideo();
                    UI.showNotification('Un participant a rejoint la salle', 'success');
                }
            },
            onRemoteDisconnect: (socketId) => {
                UI.hideRemoteVideo();
                UI.showNotification('Le participant a quitté la salle', 'info');
            },
            onError: (error) => {
                console.error('Erreur WebRTC:', error);
                UI.showNotification(`Erreur de connexion: ${error.message}`, 'error');
            },
            onParticipantUpdate: (participants) => {
                console.log('Participants mis à jour:', participants);
            },
            onPermissionChange: (changes) => {
                if (changes.canVideo !== undefined) {
                    isVideoEnabled = changes.canVideo;
                    UI.updateCameraButton(isVideoEnabled);
                }
                if (changes.canAudio !== undefined) {
                    isAudioEnabled = changes.canAudio;
                    UI.updateMicButton(isAudioEnabled);
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de WebRTC:', error);
        UI.showNotification('Erreur lors de l\'initialisation de la connexion', 'error');
    }

    // Gestion des événements des boutons
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            isAudioEnabled = !isAudioEnabled;
            WebRTCHandler.toggleAudio(isAudioEnabled);
            UI.updateMicButton(isAudioEnabled);
        });
    }

    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            isVideoEnabled = !isVideoEnabled;
            WebRTCHandler.toggleVideo(isVideoEnabled);
            UI.updateCameraButton(isVideoEnabled);
        });
    }

    if (screenBtn) {
        screenBtn.addEventListener('click', async () => {
            try {
                isScreenSharing = !isScreenSharing;
                const success = await WebRTCHandler.toggleScreenSharing(isScreenSharing);
                if (!success) {
                    isScreenSharing = !isScreenSharing; // Annuler le changement d'état
                }
                UI.updateScreenButton(isScreenSharing);

                if (isScreenSharing) {
                    UI.showNotification('Partage d\'écran activé', 'info');
                } else {
                    UI.showNotification('Partage d\'écran désactivé', 'info');
                }
            } catch (error) {
                console.error('Erreur lors du partage d\'écran:', error);
                isScreenSharing = false;
                UI.updateScreenButton(false);
                UI.showNotification('Erreur lors du partage d\'écran', 'error');
            }
        });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal) {
                settingsModal.style.display = 'flex';
            }
        });
    }

    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            WebRTCHandler.cleanup();
            window.location.href = 'lobby.html';
        });
    }

    // Fermer la modale des paramètres
    const closeModalButton = document.querySelector('.close');
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }

    // Appliquer les paramètres
    const applySettingsButton = document.getElementById('apply-settings');
    if (applySettingsButton) {
        applySettingsButton.addEventListener('click', () => {
            const videoSource = document.getElementById('video-source').value;
            const audioSource = document.getElementById('audio-source').value;
            const videoQuality = document.getElementById('video-quality').value;

            // Appliquer les nouveaux paramètres
            applySettings(videoSource, audioSource, videoQuality);

            // Fermer la modale
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }

    // Gérer la fermeture de la page
    window.addEventListener('unload', () => {
        WebRTCHandler.cleanup();
    });
});

/**
 * Appliquer les paramètres (exemple)
 */
function applySettings(videoSource, audioSource, videoQuality) {
    console.log('Paramètres appliqués:', { videoSource, audioSource, videoQuality });

    // Exemple : Changer la source vidéo/audio
    if (videoSource) {
        WebRTCHandler.setVideoSource(videoSource);
    }
    if (audioSource) {
        WebRTCHandler.setAudioSource(audioSource);
    }

    // Exemple : Ajuster la qualité vidéo
    if (videoQuality) {
        WebRTCHandler.adjustVideoQuality(videoQuality);
    }

    UI.showNotification('Paramètres appliqués avec succès', 'success');
}

// Créer une connexion WebRTC
function createPeerConnection(socketId) {
    const pc = new RTCPeerConnection(configuration);

    // Ajouter les tracks locaux à la connexion
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Gérer les candidats ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc-signal', {
                roomId: roomId,
                target: socketId,
                signal: event.candidate
            });
        }
    };

    // Gérer les tracks distants
    pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        displayRemoteStream(remoteStream, socketId);
    };

    // Stocker la connexion
    peerConnections[socketId] = pc;
}

// Envoyer une offre WebRTC
async function sendOffer(socketId) {
    const pc = peerConnections[socketId];
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('webrtc-signal', {
        roomId: roomId,
        target: socketId,
        signal: pc.localDescription
    });
}

// Gérer une offre WebRTC reçue
async function handleOffer(socketId, offer) {
    const pc = peerConnections[socketId];
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('webrtc-signal', {
        roomId: roomId,
        target: socketId,
        signal: pc.localDescription
    });
}

// Gérer une réponse WebRTC reçue
async function handleAnswer(socketId, answer) {
    const pc = peerConnections[socketId];
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

// Gérer un candidat ICE reçu
async function handleCandidate(socketId, candidate) {
    const pc = peerConnections[socketId];
    if (!pc) return;

    await pc.addIceCandidate(new RTCIceCandidate(candidate));
}