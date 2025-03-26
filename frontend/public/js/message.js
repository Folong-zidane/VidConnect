
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