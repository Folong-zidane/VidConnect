// Éléments DOM
const localVideo = document.getElementById('local-video');
const teacherVideo = document.getElementById('teacher-video');
const roomName = document.getElementById('room-name');
const connectionStatus = document.getElementById('connection-status');
const localVideoContainer = document.getElementById('local-video-container');
const teacherVideoContainer = document.getElementById('teacher-video-container');
const otherParticipants = document.getElementById('other-participants');
const userCircle = document.getElementById('user-circle');
const teacherCircle = document.getElementById('teacher-circle');

// Éléments de contrôle
const micBtn = document.getElementById('mic-btn');
const cameraBtn = document.getElementById('camera-btn');
const screenBtn = document.getElementById('screen-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = document.querySelector('.close');
const applySettingsBtn = document.getElementById('apply-settings');

// Boutons de contrôle des vidéos principales
const minimizeTeacher = document.getElementById('minimize-teacher');
const hideTeacher = document.getElementById('hide-teacher');
const minimizeLocal = document.getElementById('minimize-local');
const hideLocal = document.getElementById('hide-local');

// Indicateurs
const localMic = document.getElementById('local-mic');
const localCamera = document.getElementById('local-camera');
const teacherMic = document.getElementById('teacher-mic');
const teacherCamera = document.getElementById('teacher-camera');

// Variables globales
let localStream;
let teacherStream;
let peerConnections = {}; // Stocker les connexions WebRTC
const socket = io(); // Connexion au serveur de signalisation
let isTeacher = false;
let micEnabled = true;
let cameraEnabled = true;
let screenShareActive = false;
let localVideoMinimized = false;
let teacherVideoMinimized = false;
let localVideoHidden = false;
let teacherVideoHidden = false;

// Configuration WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // Serveur STUN public
    ],
};

// Initialisation des périphériques
async function initializeDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Remplir les sélecteurs de périphériques
        const videoSource = document.getElementById('video-source');
        const audioSource = document.getElementById('audio-source');
        const audioOutput = document.getElementById('audio-output');
        
        // Vider les sélecteurs
        videoSource.innerHTML = '';
        audioSource.innerHTML = '';
        audioOutput.innerHTML = '';
        
        // Ajouter les périphériques aux sélecteurs
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            if (device.kind === 'videoinput') {
                option.text = device.label || `Caméra ${videoSource.length + 1}`;
                videoSource.appendChild(option);
            } else if (device.kind === 'audioinput') {
                option.text = device.label || `Microphone ${audioSource.length + 1}`;
                audioSource.appendChild(option);
            } else if (device.kind === 'audiooutput') {
                option.text = device.label || `Haut-parleur ${audioOutput.length + 1}`;
                audioOutput.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erreur lors de l\'énumération des périphériques:', error);
    }
}

// Capturer le flux vidéo local
async function startLocalStream() {
    try {
        // Essayer d'obtenir la caméra et le microphone selon le rôle
        if (isTeacher) {
            // Enseignant : caméra et micro activés par défaut
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            
            // Activer la caméra et le micro
            cameraEnabled = true;
            micEnabled = true;
            
            // Afficher le flux local
            localVideo.srcObject = localStream;
            
            // Cacher le cercle avec les initiales
            userCircle.style.display = 'none';
            
            // Mettre à jour les indicateurs
            updateMicIndicator(localMic, true);
            updateCameraIndicator(localCamera, true);
        } else {
            // Étudiant : seulement micro activé par défaut, caméra désactivée
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: false, 
                audio: true 
            });
            
            // Désactiver la caméra, activer le micro
            cameraEnabled = false;
            micEnabled = true;
            
            // Masquer la vidéo, afficher le cercle
            localVideo.srcObject = null;
            userCircle.style.display = 'flex';
            
            // Mettre à jour les indicateurs
            updateMicIndicator(localMic, true);
            updateCameraIndicator(localCamera, false);
            
            // Mettre à jour l'apparence des boutons de contrôle
            updateControlButton(cameraBtn, false);
        }
    } catch (error) {
        console.error('Erreur lors de la capture du flux local:', error);
        
        // Essayer de récupérer seulement l'audio si la vidéo échoue
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micEnabled = true;
            cameraEnabled = false;
            
            // Masquer la vidéo, afficher le cercle
            localVideo.srcObject = null;
            userCircle.style.display = 'flex';
            
            // Mettre à jour les indicateurs
            updateMicIndicator(localMic, true);
            updateCameraIndicator(localCamera, false);
            
            // Mettre à jour l'apparence des boutons de contrôle
            updateControlButton(cameraBtn, false);
        } catch (audioError) {
            console.error('Erreur lors de la capture audio:', audioError);
            alert('Impossible d\'accéder au microphone. Veuillez vérifier vos permissions.');
            
            // Désactiver les deux
            micEnabled = false;
            cameraEnabled = false;
            
            // Mettre à jour les indicateurs
            updateMicIndicator(localMic, false);
            updateCameraIndicator(localCamera, false);
            
            // Mettre à jour l'apparence des boutons de contrôle
            updateControlButton(micBtn, false);
            updateControlButton(cameraBtn, false);
        }
    }
}

// Gérer la connexion de l'enseignant (initiateur)
function handleTeacherConnection(teacherSocketId, stream) {
    // Afficher le flux de l'enseignant
    teacherVideo.srcObject = stream;
    teacherStream = stream;
    
    // Cacher le cercle
    teacherCircle.style.display = 'none';
    
    // Déterminer si l'audio et la vidéo sont activés
    const hasVideo = stream.getVideoTracks().length > 0 && 
                      stream.getVideoTracks()[0].enabled;
    const hasAudio = stream.getAudioTracks().length > 0 && 
                     stream.getAudioTracks()[0].enabled;
    
    // Mettre à jour les indicateurs de l'enseignant
    updateMicIndicator(teacherMic, hasAudio);
    updateCameraIndicator(teacherCamera, hasVideo);
}

// Ajouter un flux vidéo distant (autre que l'enseignant)
function addRemoteVideo(socketId, stream, username) {
    // Créer un nouvel élément vidéo
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper remote-video';
    videoWrapper.id = `remote-video-${socketId}`;
    
    const videoElement = document.createElement('video');
    videoElement.className = 'video-player';
    videoElement.autoplay = true;
    videoElement.playsinline = true;
    videoElement.srcObject = stream;
    
    const userName = document.createElement('div');
    userName.className = 'user-name';
    userName.textContent = username || 'Participant';
    
    // Créer le cercle pour quand la vidéo est désactivée
    const userCircleEl = document.createElement('div');
    userCircleEl.className = 'user-circle';
    userCircleEl.id = `circle-${socketId}`;
    userCircleEl.textContent = (username || 'P').charAt(0).toUpperCase();
    
    // Déterminer si l'audio et la vidéo sont activés
    const hasVideo = stream.getVideoTracks().length > 0 && 
                     stream.getVideoTracks()[0].enabled;
    const hasAudio = stream.getAudioTracks().length > 0 && 
                     stream.getAudioTracks()[0].enabled;
    
    // Afficher/masquer le cercle en fonction de l'état de la caméra
    userCircleEl.style.display = hasVideo ? 'none' : 'flex';
    
    // Créer les indicateurs
    const micIndicator = document.createElement('div');
    micIndicator.className = `mic-indicator ${!hasAudio ? 'muted' : ''}`;
    micIndicator.innerHTML = `<i class="fas fa-microphone${!hasAudio ? '-slash' : ''}"></i>`;
    
    const cameraIndicator = document.createElement('div');
    cameraIndicator.className = `camera-indicator ${!hasVideo ? 'disabled' : ''}`;
    cameraIndicator.innerHTML = `<i class="fas fa-video${!hasVideo ? '-slash' : ''}"></i>`;
    
    // Ajouter tous les éléments
    videoWrapper.appendChild(videoElement);
    videoWrapper.appendChild(userName);
    videoWrapper.appendChild(userCircleEl);
    videoWrapper.appendChild(micIndicator);
    videoWrapper.appendChild(cameraIndicator);
    
    // Ajouter à la grille des participants secondaires
    otherParticipants.appendChild(videoWrapper);
    
    // Ajuster la taille des vignettes en fonction du nombre
    adjustRemoteVideoSize();
    
    // Écouter les changements de flux (quand la caméra ou le micro est activé/désactivé)
    stream.onaddtrack = () => {
        updateRemoteVideoStatus(socketId, stream);
    };
    stream.onremovetrack = () => {
        updateRemoteVideoStatus(socketId, stream);
    };
}

// Mettre à jour le statut audio/vidéo d'un participant distant
function updateRemoteVideoStatus(socketId, stream) {
    const videoWrapper = document.getElementById(`remote-video-${socketId}`);
    if (!videoWrapper) return;
    
    const userCircleEl = document.getElementById(`circle-${socketId}`);
    const micIndicator = videoWrapper.querySelector('.mic-indicator');
    const cameraIndicator = videoWrapper.querySelector('.camera-indicator');
    
    // Déterminer si l'audio et la vidéo sont activés
    const hasVideo = stream.getVideoTracks().length > 0 && 
                     stream.getVideoTracks()[0].enabled;
    const hasAudio = stream.getAudioTracks().length > 0 && 
                     stream.getAudioTracks()[0].enabled;
    
    // Mettre à jour l'affichage
    userCircleEl.style.display = hasVideo ? 'none' : 'flex';
    
    // Mettre à jour les indicateurs
    updateMicIndicator(micIndicator, hasAudio);
    updateCameraIndicator(cameraIndicator, hasVideo);
}

// Supprimer un flux vidéo distant
function removeRemoteVideo(socketId) {
    const videoWrapper = document.getElementById(`remote-video-${socketId}`);
    if (videoWrapper) {
        videoWrapper.remove();
        
        // Réajuster la taille des vignettes
        adjustRemoteVideoSize();
    }
}

// Ajuster la taille des vignettes en fonction du nombre de participants
function adjustRemoteVideoSize() {
    const remoteVideos = document.querySelectorAll('#other-participants .remote-video');
    const count = remoteVideos.length;
    
    if (count === 0) {
        // Si aucun participant supplémentaire, masquer la section
        otherParticipants.style.display = 'none';
        return;
    }
    
    // Afficher la section
    otherParticipants.style.display = 'flex';
    
    // Ajuster la taille en fonction du nombre de participants
    if (count <= 4) {
        // Jusqu'à 4 participants, taille moyenne
        remoteVideos.forEach(video => {
            video.style.width = `${100 / count}%`;
            video.style.maxWidth = '25%';
        });
    } else {
        // Plus de 4 participants, taille réduite fixe
        remoteVideos.forEach(video => {
            video.style.width = '20%';
            video.style.maxWidth = '20%';
        });
    }
}

// Gérer l'affichage des contrôles de vidéo (minimiser/masquer)
function toggleMinimizeTeacher() {
    teacherVideoMinimized = !teacherVideoMinimized;
    teacherVideoContainer.classList.toggle('minimized', teacherVideoMinimized);
    
    // Mettre à jour l'icône du bouton
    minimizeTeacher.innerHTML = teacherVideoMinimized ? 
        '<i class="fas fa-expand"></i>' : 
        '<i class="fas fa-compress"></i>';
    
    // Réorganiser l'affichage
    adjustMainVideosLayout();
}

function toggleHideTeacher() {
    teacherVideoHidden = !teacherVideoHidden;
    teacherVideoContainer.classList.toggle('hidden', teacherVideoHidden);
    
    // Mettre à jour l'icône du bouton
    hideTeacher.innerHTML = teacherVideoHidden ? 
        '<i class="fas fa-eye"></i>' : 
        '<i class="fas fa-eye-slash"></i>';
    
    // Réorganiser l'affichage
    adjustMainVideosLayout();
}

function toggleMinimizeLocal() {
    localVideoMinimized = !localVideoMinimized;
    localVideoContainer.classList.toggle('minimized', localVideoMinimized);
    
    // Mettre à jour l'icône du bouton
    minimizeLocal.innerHTML = localVideoMinimized ? 
        '<i class="fas fa-expand"></i>' : 
        '<i class="fas fa-compress"></i>';
    
    // Réorganiser l'affichage
    adjustMainVideosLayout();
}

function toggleHideLocal() {
    localVideoHidden = !localVideoHidden;
    localVideoContainer.classList.toggle('hidden', localVideoHidden);
    
    // Mettre à jour l'icône du bouton
    hideLocal.innerHTML = localVideoHidden ? 
        '<i class="fas fa-eye"></i>' : 
        '<i class="fas fa-eye-slash"></i>';
    
    // Réorganiser l'affichage
    adjustMainVideosLayout();
}

// Ajuster la disposition des vidéos principales
function adjustMainVideosLayout() {
    const mainVideosContainer = document.getElementById('main-videos');
    
    // Récupérer l'état des vidéos principales
    const teacherVisible = !teacherVideoHidden;
    const localVisible = !localVideoHidden;
    
    if (teacherVisible && localVisible) {
        // Les deux vidéos sont visibles
        mainVideosContainer.className = 'split-view';
        
        // Ajuster en fonction de la minimisation
        if (teacherVideoMinimized && !localVideoMinimized) {
            // Teacher minimisé, local normal
            mainVideosContainer.className = 'local-main';
        } else if (!teacherVideoMinimized && localVideoMinimized) {
            // Local minimisé, teacher normal
            mainVideosContainer.className = 'teacher-main';
        } else if (teacherVideoMinimized && localVideoMinimized) {
            // Les deux minimisés
            mainVideosContainer.className = 'both-minimized';
        }
    } else if (teacherVisible && !localVisible) {
        // Seulement teacher visible
        mainVideosContainer.className = 'teacher-only';
    } else if (!teacherVisible && localVisible) {
        // Seulement local visible
        mainVideosContainer.className = 'local-only';
    } else {
        // Aucune vidéo principale visible
        mainVideosContainer.className = 'no-main-video';
    }
}

// Contrôle du microphone
function toggleMic() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    micEnabled = !micEnabled;
    audioTracks.forEach(track => {
        track.enabled = micEnabled;
    });
    
    // Mettre à jour l'indicateur
    updateMicIndicator(localMic, micEnabled);
    
    // Mettre à jour l'apparence du bouton
    updateControlButton(micBtn, micEnabled);
    
    // Signaler aux autres participants
    broadcastStreamState();
}

// Contrôle de la caméra
async function toggleCamera() {
    if (!cameraEnabled) {
        // Activer la caméra si elle est désactivée
        try {
            // Vérifier si nous avons déjà un flux vidéo
            if (!localStream || !localStream.getVideoTracks().length) {
                // Obtenir un nouveau flux vidéo
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                
                // Ajouter les pistes vidéo au flux existant
                videoStream.getVideoTracks().forEach(track => {
                    localStream.addTrack(track);
                    
                    // Mettre à jour les connexions existantes
                    Object.values(peerConnections).forEach(pc => {
                        pc.addTrack(track, localStream);
                    });
                });
            } else {
                // Réactiver les pistes existantes
                localStream.getVideoTracks().forEach(track => {
                    track.enabled = true;
                });
            }
            
            // Mettre à jour la vidéo locale
            localVideo.srcObject = localStream;
            
            // Masquer le cercle
            userCircle.style.display = 'none';
            
            cameraEnabled = true;
        } catch (error) {
            console.error('Erreur lors de l\'activation de la caméra:', error);
            alert('Impossible d\'accéder à la caméra. Veuillez vérifier vos permissions.');
            return;
        }
    } else {
        // Désactiver la caméra
        localStream.getVideoTracks().forEach(track => {
            track.enabled = false;
        });
        
        // Afficher le cercle
        userCircle.style.display = 'flex';
        
        cameraEnabled = false;
    }
    
    // Mettre à jour l'indicateur
    updateCameraIndicator(localCamera, cameraEnabled);
    
    // Mettre à jour l'apparence du bouton
    updateControlButton(cameraBtn, cameraEnabled);
    
    // Signaler aux autres participants
    broadcastStreamState();
}

// Partage d'écran
async function toggleScreenShare() {
    if (screenShareActive) {
        // Arrêter le partage d'écran
        localStream.getVideoTracks().forEach(track => {
            if (track.label.includes('screen')) {
                track.stop();
            }
        });
        
        // Restaurer la caméra si elle était activée avant
        try {
            if (cameraEnabled) {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                localStream.getVideoTracks().forEach(track => track.stop());
                
                videoStream.getVideoTracks().forEach(track => {
                    localStream.addTrack(track);
                    
                    // Mettre à jour les connexions existantes
                    Object.values(peerConnections).forEach(pc => {
                        const senders = pc.getSenders();
                        const videoSender = senders.find(sender => 
                            sender.track && sender.track.kind === 'video'
                        );
                        
                        if (videoSender) {
                            videoSender.replaceTrack(track);
                        } else {
                            pc.addTrack(track, localStream);
                        }
                    });
                });
                
                localVideo.srcObject = localStream;
            } else {
                // Si la caméra était désactivée, afficher le cercle
                userCircle.style.display = 'flex';
            }
        } catch (error) {
            console.error('Erreur lors de la restauration de la caméra:', error);
            cameraEnabled = false;
            userCircle.style.display = 'flex';
        }
        
        screenShareActive = false;
    } else {
        // Démarrer le partage d'écran
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                }
            });
            
            // Remplacer la piste vidéo par celle du partage d'écran
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Gérer la fin du partage d'écran par l'utilisateur
            screenTrack.onended = () => {
                toggleScreenShare();
            };
            
            // Remplacer la piste vidéo dans le flux local
            if (localStream.getVideoTracks().length > 0) {
                const oldTrack = localStream.getVideoTracks()[0];
                localStream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            
            localStream.addTrack(screenTrack);
            
            // Mettre à jour la vidéo locale
            localVideo.srcObject = localStream;
            
            // Masquer le cercle
            userCircle.style.display = 'none';
            
            // Mettre à jour les connexions existantes
            Object.values(peerConnections).forEach(pc => {
                const senders = pc.getSenders();
                const videoSender = senders.find(sender => 
                    sender.track && sender.track.kind === 'video'
                );
                
                if (videoSender) {
                    videoSender.replaceTrack(screenTrack);
                } else {
                    pc.addTrack(screenTrack, localStream);
                }
            });
            
            screenShareActive = true;
        } catch (error) {
            console.error('Erreur lors du partage d\'écran:', error);
            alert('Impossible de partager l\'écran. Veuillez vérifier vos permissions.');
            return;
        }
    }
    
    // Mettre à jour l'apparence du bouton
    updateControlButton(screenBtn, screenShareActive);
    
    // Signaler aux autres participants
    broadcastStreamState();
}

// Mettre à jour l'apparence des boutons de contrôle
function updateControlButton(button, enabled) {
    if (enabled) {
        button.classList.remove('disabled');
    } else {
        button.classList.add('disabled');
    }
}

// Mettre à jour l'indicateur de microphone
function updateMicIndicator(indicator, enabled) {
    if (enabled) {
        indicator.classList.remove('muted');
        indicator.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
        indicator.classList.add('muted');
        indicator.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
}

// Mettre à jour l'indicateur de caméra
function updateCameraIndicator(indicator, enabled) {
    if (enabled) {
        indicator.classList.remove('disabled');
        indicator.innerHTML = '<i class="fas fa-video"></i>';
    } else {
        indicator.classList.add('disabled');
        indicator.innerHTML = '<i class="fas fa-video-slash"></i>';
    }
}

// Signaler aux autres participants l'état de notre flux
function broadcastStreamState() {
    socket.emit('stream-state', {
        roomId: socket.roomId,
        micEnabled: micEnabled,
        cameraEnabled: cameraEnabled,
        screenShareActive: screenShareActive
    });
}

// Créer une connexion WebRTC pour un participant spécifique
function createPeerConnection(targetSocketId, isTeacherConnection = false) {
    const pc = new RTCPeerConnection(configuration);

    // Ajouter le flux local à la connexion
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
    }

    // Gérer les candidats ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc-signal', {
                roomId: socket.roomId,
                target: targetSocketId,
                signal: event.candidate
            });
        }
    };

    // Gérer le flux distant
    pc.ontrack = (event) => {
        if (isTeacherConnection) {
            // Il s'agit de l'enseignant
            handleTeacherConnection(targetSocketId, event.streams[0]);
        } else {
            // Il s'agit d'un autre participant
            addRemoteVideo(targetSocketId, event.streams[0], peerConnections[targetSocketId]?.username);
        }
    };

    // Gérer les changements d'état de connexion
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            // Gérer la déconnexion
            if (isTeacherConnection && targetSocketId === socket.teacherId) {
                // L'enseignant est déconnecté
                teacherVideo.srcObject = null;
                teacherCircle.style.display = 'flex';
                updateMicIndicator(teacherMic, false);
                updateCameraIndicator(teacherCamera, false);
            } else {
                // Un autre participant est déconnecté
                removeRemoteVideo(targetSocketId);
            }
        }
    };

    // Stocker la connexion
    peerConnections[targetSocketId] = {
        pc: pc,
        isTeacher: isTeacherConnection,
        username: null // Sera défini plus tard
    };
    
    return pc;
}

// Envoyer une offre WebRTC à un participant spécifique
async function sendOffer(targetSocketId) {
    const connection = peerConnections[targetSocketId];
    if (!connection) return;
    
    const pc = connection.pc;

    try {
        // Créer une offre
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Envoyer l'offre
        socket.emit('webrtc-signal', {
            roomId: socket.roomId,
            target: targetSocketId,
            signal: pc.localDescription
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'offre:', error);
    }
}

// Recevoir un signal WebRTC
socket.on('webrtc-signal', async (data) => {
    const { from, signal, username } = data;

    // Vérifier si c'est l'enseignant
    const isTeacherSignal = from === socket.teacherId;

    if (!peerConnections[from]) {
        // Créer une connexion si elle n'existe pas déjà
        createPeerConnection(from, isTeacherSignal);
        
        // Stocker le nom d'utilisateur
        if (username) {
            peerConnections[from].username = username;
        }
    }
    
    const pc = peerConnections[from].pc;

    try {
        if (signal.type === 'offer') {
            // Traiter l'offre
            await pc.setRemoteDescription(new RTCSessionDescription(signal));

            // Créer une réponse
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Envoyer la réponse
            socket.emit('webrtc-signal', {
                roomId: socket.roomId,
                target: from,
                signal: pc.localDescription
            });
        } else if (signal.type === 'answer') {
            // Traiter la réponse
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
            // Ajouter le candidat ICE
            await pc.addIceCandidate(new RTCIceCandidate(signal));
        }
    } catch (error) {
        console.error('Erreur lors du traitement du signal WebRTC:', error);
    }
});

// Recevoir l'état du flux d'un participant
socket.on('stream-state', (data) => {
    const { socketId, micEnabled, cameraEnabled, screenShareActive } = data;
    
    // Mettre à jour l'affichage selon le participant
    if (socketId === socket.teacherId) {
        // Il s'agit de l'enseignant
        updateMicIndicator(teacherMic, micEnabled);
        updateCameraIndicator(teacherCamera, cameraEnabled);
        
        // Afficher/masquer le cercle
        if (teacherVideo.srcObject) {
            teacherCircle.style.display = cameraEnabled ? 'none' : 'flex';
        }
    } else {
        // Il s'agit d'un autre participant
        const videoWrapper = document.getElementById(`remote-video-${socketId}`);
        if (!videoWrapper) return;
        
        const micIndicator = videoWrapper.querySelector('.mic-indicator');
        const cameraIndicator = videoWrapper.querySelector('.camera-indicator');
        const userCircleEl = document.getElementById(`circle-${socketId}`);
        
        updateMicIndicator(micIndicator, micEnabled);
        updateCameraIndicator(cameraIndicator, cameraEnabled);
        
        // Afficher/masquer le cercle
        if (userCircleEl) {
            userCircleEl.style.display = cameraEnabled ? 'none' : 'flex';
        }
    }
});


// Gérer les participants qui rejoignent
socket.on('user-joined', (data) => {
    const { socketId, username, isTeacher: joinedIsTeacher } = data;
    console.log(`Nouveau participant: ${username} (${socketId}), Enseignant: ${joinedIsTeacher}`);

    // Créer une connexion WebRTC avec le nouveau participant
    createPeerConnection(socketId, joinedIsTeacher);
    sendOffer(socketId);
    
    // Si c'est un enseignant, mettre à jour l'interface
    if (joinedIsTeacher && teacherVideoContainer) {
        teacherVideoContainer.dataset.socketId = socketId;
        const teacherName = teacherVideoContainer.querySelector('.user-name');
        if (teacherName) {
            teacherName.textContent = username;
        }
    }
    
    // Notifier l'arrivée d'un nouveau participant
    showNotification(`${username} a rejoint la salle`);
});

// Gérer les participants qui quittent
socket.on('user-left', (data) => {
    const { socketId, username } = data;
    console.log(`Participant parti: ${socketId}`);

    // Supprimer le flux vidéo distant
    removeRemoteVideo(socketId);

    // Si c'était l'enseignant, réinitialiser la vidéo de l'enseignant
    const teacherSocketId = teacherVideoContainer?.dataset.socketId;
    if (teacherSocketId === socketId) {
        teacherVideo.srcObject = null;
        teacherStream = null;
        teacherCircle.style.display = 'flex';
        updateMicIndicator(teacherMic, false);
        updateCameraIndicator(teacherCamera, false);
    }

    // Fermer la connexion WebRTC
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
    }
    
    // Notifier le départ
    showNotification(`${username || 'Un participant'} a quitté la salle`);
    
    // Réajuster l'interface
    adjustRemoteVideoSize();
});
// Gérer les participants qui quittent
socket.on('user-left', (data) => {
    const { socketId, isTeacher: leftIsTeacher } = data;
    console.log(`Participant parti: ${socketId}`);

    // Si c'était l'enseignant qui est parti
    if (leftIsTeacher) {
        // Vider le flux vidéo de l'enseignant
        teacherVideo.srcObject = null;
        teacherStream = null;
        teacherCircle.style.display = 'flex';
        updateMicIndicator(teacherMic, false);
        updateCameraIndicator(teacherCamera, false);
    } else {
        // Supprimer le flux vidéo distant
        removeRemoteVideo(socketId);
    }

    // Fermer la connexion WebRTC
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
    }
    
    // Réajuster la disposition
    adjustMainVideosLayout();
    adjustRemoteVideoSize();
});

// Rejoindre une salle
socket.on('connect', async () => {
    const roomId = new URLSearchParams(window.location.search).get('room');
    const username = new URLSearchParams(window.location.search).get('username');
    const teacherParam = new URLSearchParams(window.location.search).get('isTeacher');
    
    // Déterminer si l'utilisateur est enseignant
    isTeacher = teacherParam === 'true';

    if (roomId && username) {
        try {
            // Initialiser les périphériques
            await initializeDevices();
            
            // Démarrer le flux local (avec ou sans vidéo selon le rôle)
            await startLocalStream();

            // Rejoindre la salle
            socket.emit('join-room', { roomId, username, isTeacher }, (response) => {
                if (response.success) {
                    // Mettre à jour l'interface
                    roomName.textContent = roomId;
                    connectionStatus.innerHTML = '<span class="connected">Connecté</span>';
                    
                    // Pour chaque participant déjà dans la salle
                    response.participants.forEach(participant => {
                        if (participant.socketId !== socket.id) {
                            // Créer une connexion WebRTC avec chaque participant
                            createPeerConnection(participant.socketId, participant.isTeacher);
                            
                            // Envoyer une offre
                            if (!participant.isTeacher) {
                                sendOffer(participant.socketId);
                            }
                        }
                    });
                    
                    // Diffuser l'état initial du flux
                    broadcastStreamState();
                    
                    // Configurer la mise en page en fonction du rôle
                    adjustMainVideosLayout();
                } else {
                    console.error('Erreur lors de la jointure de la salle:', response.message);
                    alert(`Erreur de connexion: ${response.message}`);
                }
            });
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            alert('Erreur lors de l\'initialisation des périphériques. Veuillez réessayer.');
        }
    } else {
        alert('Informations manquantes. Veuillez retourner à la page d\'accueil.');
        window.location.href = 'lobby.html';
    }
});

// Gestionnaires d'événements pour les contrôles d'interface

// Ouvrir la modale des paramètres
settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

// Fermer la modale des paramètres
closeBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// Fermer la modale en cliquant en dehors
window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Appliquer les paramètres
applySettingsBtn.addEventListener('click', async () => {
    const videoSource = document.getElementById('video-source').value;
    const audioSource = document.getElementById('audio-source').value;
    const audioOutput = document.getElementById('audio-output').value;
    const videoQuality = document.getElementById('video-quality').value;
    
    // Stopper les pistes actuelles
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Configurer les contraintes en fonction de la qualité sélectionnée
    let videoConstraints = { deviceId: videoSource ? { exact: videoSource } : undefined };
    
    if (videoQuality === 'low') {
        videoConstraints.width = { ideal: 640 };
        videoConstraints.height = { ideal: 480 };
    } else if (videoQuality === 'medium') {
        videoConstraints.width = { ideal: 1280 };
        videoConstraints.height = { ideal: 720 };
    } else if (videoQuality === 'high') {
        videoConstraints.width = { ideal: 1920 };
        videoConstraints.height = { ideal: 1080 };
    }
    
    try {
        // Obtenir un nouveau flux avec les contraintes mises à jour
        localStream = await navigator.mediaDevices.getUserMedia({
            video: cameraEnabled ? videoConstraints : false,
            audio: micEnabled ? { deviceId: audioSource ? { exact: audioSource } : undefined } : false
        });
        
        // Mettre à jour la vidéo locale
        localVideo.srcObject = localStream;
        
        // Mettre à jour les pistes dans toutes les connexions
        Object.values(peerConnections).forEach(pc => {
            // Remplacer les pistes existantes
            const senders = pc.getSenders();
            
            localStream.getTracks().forEach(track => {
                const sender = senders.find(s => s.track && s.track.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                } else {
                    pc.addTrack(track, localStream);
                }
            });
        });
        
        // Définir le périphérique de sortie audio si supporté
        if (typeof localVideo.setSinkId === 'function' && audioOutput) {
            try {
                await localVideo.setSinkId(audioOutput);
                
                // Appliquer le même périphérique à toutes les vidéos distantes
                document.querySelectorAll('.video-player').forEach(async video => {
                    if (video !== localVideo) {
                        try {
                            await video.setSinkId(audioOutput);
                        } catch (error) {
                            console.error('Erreur lors du changement de périphérique de sortie:', error);
                        }
                    }
                });
            } catch (error) {
                console.error('Erreur lors du changement de périphérique de sortie:', error);
            }
        }
        
        // Diffuser le nouvel état du flux
        broadcastStreamState();
        
        // Mettre à jour l'interface
        userCircle.style.display = cameraEnabled ? 'none' : 'flex';
        updateMicIndicator(localMic, micEnabled);
        updateCameraIndicator(localCamera, cameraEnabled);
        
        // Fermer la modale
        settingsModal.style.display = 'none';
    } catch (error) {
        console.error('Erreur lors du changement de périphériques:', error);
        alert('Erreur lors du changement de périphériques. Veuillez vérifier vos permissions.');
    }
});

// Contrôles de la vidéo principale
minimizeTeacher.addEventListener('click', toggleMinimizeTeacher);
hideTeacher.addEventListener('click', toggleHideTeacher);
minimizeLocal.addEventListener('click', toggleMinimizeLocal);
hideLocal.addEventListener('click', toggleHideLocal);

// Contrôles des périphériques
micBtn.addEventListener('click', toggleMic);
cameraBtn.addEventListener('click', toggleCamera);
screenBtn.addEventListener('click', toggleScreenShare);

// Quitter la salle
document.getElementById('leave-btn').addEventListener('click', (e) => {
    // Confirmer avant de quitter
    if (!confirm('Êtes-vous sûr de vouloir quitter cette salle ?')) {
        e.preventDefault();
    } else {
        // Arrêter tous les flux
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Fermer toutes les connexions WebRTC
        Object.values(peerConnections).forEach(pc => pc.close());
        
        // Naviguer vers la page d'accueil
        // window.location.href = 'lobby.html';
    }
});

// Fonction pour mettre à jour l'apparence des boutons de contrôle
function updateControlButton(button, enabled) {
    if (!button) return;
    
    if (enabled) {
        button.classList.remove('disabled');
    } else {
        button.classList.add('disabled');
    }
}

// Initialiser l'application au chargement
window.addEventListener('load', () => {
    // Adapter l'interface à la taille de l'écran
    adjustMainVideosLayout();
    adjustRemoteVideoSize();
    
    // Écouter les redimensionnements
    window.addEventListener('resize', () => {
        adjustMainVideosLayout();
        adjustRemoteVideoSize();
    });
});

// Gérer les erreurs de connexion
socket.on('connect_error', (error) => {
    console.error('Erreur de connexion au serveur:', error);
    connectionStatus.innerHTML = '<span class="error">Erreur de connexion</span>';
});

socket.on('connect_timeout', () => {
    console.error('Timeout de connexion au serveur');
    connectionStatus.innerHTML = '<span class="error">Timeout de connexion</span>';
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnecté au serveur après ${attemptNumber} tentatives`);
    connectionStatus.innerHTML = '<span class="connected">Reconnecté</span>';
});

socket.on('error', (error) => {
    console.error('Erreur de socket:', error);
    connectionStatus.innerHTML = '<span class="error">Erreur de socket</span>';
});


// Gérer les messages du chat
socket.on('chat-message', (data) => {
    const { sender, message, isTeacher, timestamp } = data;
    addChatMessage(sender, message, isTeacher, timestamp);
});

// Gérer les demandes de prise de parole
socket.on('raise-hand', (data) => {
    const { username, socketId } = data;
    showNotification(`${username} lève la main`);
    
    // Si l'utilisateur courant est l'enseignant, afficher un bouton pour accepter
    if (isTeacher) {
        const notification = document.createElement('div');
        notification.className = 'teacher-notification';
        notification.innerHTML = `
            <span>${username} lève la main</span>
            <button data-socket-id="${socketId}">Autoriser</button>
        `;
        
        const container = document.getElementById('notifications-container');
        container.appendChild(notification);
        
        // Ajouter l'événement sur le bouton
        notification.querySelector('button').addEventListener('click', function() {
            socket.emit('approve-hand', { 
                roomId: socket.roomId, 
                socketId: this.dataset.socketId 
            });
            notification.remove();
        });
        
        // Supprimer automatiquement après 15 secondes
        setTimeout(() => notification.remove(), 15000);
    }
});

// Gérer l'approbation de prise de parole
socket.on('hand-approved', (data) => {
    const { by } = data;
    showNotification(`${by} vous a autorisé à parler`);
    
    // Activer automatiquement le micro si approuvé
    if (!micEnabled) {
        toggleMic();
    }
});

// Gérer les actions de contrôle de l'enseignant
socket.on('teacher-control', (data) => {
    const { action, target } = data;
    
    // Si l'action concerne cet utilisateur
    if (target === socket.id) {
        if (action === 'mute-mic') {
            // Désactiver forcément le micro
            if (micEnabled) {
                toggleMic(true); // force mute
            }
            showNotification("L'enseignant a désactivé votre microphone");
        } else if (action === 'disable-camera') {
            // Désactiver forcément la caméra
            if (cameraEnabled) {
                toggleCamera(true); // force disable
            }
            showNotification("L'enseignant a désactivé votre caméra");
        } else if (action === 'allow-mic') {
            showNotification("L'enseignant vous autorise à parler");
        } else if (action === 'allow-camera') {
            showNotification("L'enseignant vous autorise à activer votre caméra");
        }
    }
});

// Gérer le changement de configuration de la salle
socket.on('room-config-updated', (data) => {
    const { config } = data;
    
    // Mettre à jour l'interface en fonction de la configuration
    if (config.chatEnabled === false) {
        disableChat();
    } else if (config.chatEnabled === true) {
        enableChat();
    }
    
    if (config.allowStudentQuestions === false && !isTeacher) {
        document.getElementById('raise-hand-btn').style.display = 'none';
    } else if (config.allowStudentQuestions === true && !isTeacher) {
        document.getElementById('raise-hand-btn').style.display = 'block';
    }
    
    showNotification("Les paramètres de la salle ont été mis à jour");
});


// Afficher une notification
function showNotification(message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    const container = document.getElementById('notifications-container');
    container.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Supprimer après la durée spécifiée
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Ajouter un message au chat
function addChatMessage(sender, message, isTeacherSender = false, timestamp = Date.now()) {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    if (sender === 'Vous') {
        messageElement.classList.add('own-message');
    }
    
    if (isTeacherSender) {
        messageElement.classList.add('teacher-message');
    }
    
    const time = new Date(timestamp);
    const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${sender}${isTeacherSender ? ' (Enseignant)' : ''}</span>
            <span class="message-time">${timeString}</span>
        </div>
        <div class="message-content">${message}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Notification si le chat n'est pas ouvert
    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel && !chatPanel.classList.contains('open') && sender !== 'Vous') {
        const chatButton = document.getElementById('chat-btn');
        chatButton.classList.add('notification-dot');
    }
}

// Désactiver le chat
function disableChat() {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send');
    
    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatInput.placeholder = "Le chat a été désactivé par l'enseignant";
}

// Activer le chat
function enableChat() {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send');
    
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    chatInput.placeholder = "Tapez votre message ici...";
}

// Envoyer un message dans le chat
function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message) {
        // Émettre le message au serveur
        socket.emit('chat-message', {
            roomId: socket.roomId,
            message: message
        });
        
        // Ajouter le message localement
        addChatMessage('Vous', message, isTeacher);
        
        // Réinitialiser l'input
        chatInput.value = '';
    }
}

// Lever la main (pour les étudiants)
function raiseHand() {
    socket.emit('raise-hand', {
        roomId: socket.roomId
    });
    
    showNotification("Vous avez levé la main. Veuillez attendre l'autorisation de l'enseignant.");
    
    // Désactiver temporairement le bouton
    const raiseHandBtn = document.getElementById('raise-hand-btn');
    raiseHandBtn.disabled = true;
    setTimeout(() => {
        raiseHandBtn.disabled = false;
    }, 5000); // 5 secondes de cooldown
}

// Mise à jour de l'apparence des boutons de contrôle
function updateControlButton(button, enabled) {
    if (enabled) {
        button.classList.remove('disabled');
    } else {
        button.classList.add('disabled');
    }
}

// Événements des contrôles du chat
document.getElementById('chat-send')?.addEventListener('click', sendChatMessage);
document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

// Événements des contrôles d'interface
document.getElementById('chat-btn')?.addEventListener('click', () => {
    const chatPanel = document.getElementById('chat-panel');
    chatPanel.classList.toggle('open');
    document.getElementById('chat-btn').classList.remove('notification-dot');
});

document.getElementById('participants-btn')?.addEventListener('click', () => {
    const participantsPanel = document.getElementById('participants-panel');
    participantsPanel.classList.toggle('open');
});

document.getElementById('raise-hand-btn')?.addEventListener('click', raiseHand);

// Événements pour les contrôles de l'enseignant
document.getElementById('mute-all-btn')?.addEventListener('click', () => {
    socket.emit('teacher-control', {
        roomId: socket.roomId,
        action: 'mute-all'
    });
    
    showNotification("Tous les microphones des étudiants ont été désactivés");
});

document.getElementById('disable-all-cameras-btn')?.addEventListener('click', () => {
    socket.emit('teacher-control', {
        roomId: socket.roomId,
        action: 'disable-all-cameras'
    });
    
    showNotification("Toutes les caméras des étudiants ont été désactivées");
});

document.getElementById('toggle-chat-btn')?.addEventListener('click', function() {
    const enableChat = this.classList.contains('disabled');
    
    socket.emit('update-room-config', {
        roomId: socket.roomId,
        config: {
            chatEnabled: enableChat
        }
    });
    
    this.classList.toggle('disabled');
    showNotification(`Le chat a été ${enableChat ? 'activé' : 'désactivé'}`);
});

document.getElementById('toggle-questions-btn')?.addEventListener('click', function() {
    const allowQuestions = this.classList.contains('disabled');
    
    socket.emit('update-room-config', {
        roomId: socket.roomId,
        config: {
            allowStudentQuestions: allowQuestions
        }
    });
    
    this.classList.toggle('disabled');
    showNotification(`Les demandes de parole ont été ${allowQuestions ? 'activées' : 'désactivées'}`);
});

// Événements pour les contrôles des vidéos principales
minimizeTeacher?.addEventListener('click', toggleMinimizeTeacher);
hideTeacher?.addEventListener('click', toggleHideTeacher);
minimizeLocal?.addEventListener('click', toggleMinimizeLocal);
hideLocal?.addEventListener('click', toggleHideLocal);

// Événements pour les contrôles multimédias
micBtn.addEventListener('click', toggleMic);
cameraBtn.addEventListener('click', toggleCamera);
screenBtn.addEventListener('click', toggleScreenShare);

// Événements pour la modale des paramètres
settingsBtn.addEventListener('click', () => {
    initializeDevices(); // Actualiser la liste des périphériques
    settingsModal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

applySettingsBtn.addEventListener('click', async () => {
    // Récupérer les nouvelles valeurs des périphériques
    const videoSource = document.getElementById('video-source').value;
    const audioSource = document.getElementById('audio-source').value;
    const audioOutput = document.getElementById('audio-output').value;
    const videoQuality = document.getElementById('video-quality').value;
    
    // Contraintes de qualité vidéo
    let videoConstraints = { deviceId: videoSource ? { exact: videoSource } : undefined };
    
    if (videoQuality === 'low') {
        videoConstraints.width = { ideal: 640 };
        videoConstraints.height = { ideal: 480 };
    } else if (videoQuality === 'medium') {
        videoConstraints.width = { ideal: 1280 };
        videoConstraints.height = { ideal: 720 };
    } else if (videoQuality === 'high') {
        videoConstraints.width = { ideal: 1920 };
        videoConstraints.height = { ideal: 1080 };
    }
    
    try {
        // Arrêter les anciennes pistes
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Obtenir de nouvelles pistes avec les nouveaux paramètres
        localStream = await navigator.mediaDevices.getUserMedia({
            video: cameraEnabled ? videoConstraints : false,
            audio: micEnabled ? { deviceId: audioSource ? { exact: audioSource } : undefined } : false
        });
        
        // Appliquer le nouveau flux au lecteur vidéo local
        localVideo.srcObject = localStream;
        
        // Appliquer le périphérique de sortie audio si supporté
        if (typeof localVideo.setSinkId === 'function' && audioOutput) {
            await localVideo.setSinkId(audioOutput);
        }
        
        // Mettre à jour les connexions WebRTC
        for (const socketId in peerConnections) {
            const pc = peerConnections[socketId];
            
            // Remplacer les pistes dans la connexion existante
            const senders = pc.getSenders();
            
            localStream.getTracks().forEach(track => {
                const sender = senders.find(s => s.track && s.track.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                } else {
                    pc.addTrack(track, localStream);
                }
            });
        }
        
        // Informer les autres participants du changement
        broadcastStreamState();
        
        // Fermer la modale
        settingsModal.style.display = 'none';
        
        showNotification("Paramètres appliqués avec succès");
    } catch (error) {
        console.error('Erreur lors de l\'application des paramètres:', error);
        alert('Erreur lors de l\'application des paramètres. Veuillez vérifier vos permissions.');
    }
});

// Fermer la modale des paramètres si on clique en dehors
window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Initialiser l'application au chargement
window.addEventListener('load', () => {
    // L'initialisation se fait dans l'événement 'connect' du socket
});

// Gérer la fermeture de la page
window.addEventListener('beforeunload', () => {
    // Envoyer un signal de déconnexion
    if (socket.connected && socket.roomId) {
        socket.emit('leave-room', { roomId: socket.roomId });
    }
    
    // Arrêter tous les médias
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});