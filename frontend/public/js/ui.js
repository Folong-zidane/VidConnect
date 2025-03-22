// Gestionnaire d'interface utilisateur pour AudioExchange
class UI {
    constructor() {
        // Éléments DOM
        this.localVideo = document.getElementById('local-video');
        this.remoteVideo = document.getElementById('remote-video');
        this.micBtn = document.getElementById('mic-btn');
        this.cameraBtn = document.getElementById('camera-btn');
        this.screenBtn = document.getElementById('screen-btn');
        this.leaveBtn = document.getElementById('leave-btn');
        this.roomName = document.getElementById('room-name');
        this.connectionStatus = document.getElementById('connection-status');
        this.notificationContainer = document.getElementById('notification-container');
    }

    // Mettre à jour le bouton microphone
    updateMicButton(enabled) {
        this.micBtn.classList.toggle('active', enabled);
        this.micBtn.querySelector('i').classList.toggle('fa-microphone', enabled);
        this.micBtn.querySelector('i').classList.toggle('fa-microphone-slash', !enabled);
    }

    // Mettre à jour le bouton caméra
    updateCameraButton(enabled) {
        this.cameraBtn.classList.toggle('active', enabled);
        this.cameraBtn.querySelector('i').classList.toggle('fa-video', enabled);
        this.cameraBtn.querySelector('i').classList.toggle('fa-video-slash', !enabled);
    }

    // Mettre à jour le bouton de partage d'écran
    updateScreenButton(enabled) {
        this.screenBtn.classList.toggle('active', enabled);
    }

    // Afficher une notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Ajouter la notification au conteneur
        this.notificationContainer.appendChild(notification);

        // Supprimer la notification après 3 secondes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Afficher la vidéo distante
    showRemoteVideo() {
        this.remoteVideo.style.display = 'block';
    }

    // Masquer la vidéo distante
    hideRemoteVideo() {
        this.remoteVideo.style.display = 'none';
    }

    // Mettre à jour le statut de connexion
    updateConnectionStatus(status, type = 'info') {
        this.connectionStatus.textContent = status;
        this.connectionStatus.className = type; // Appliquer une classe pour le style
    }

    // Mettre à jour le nom de la salle
    updateRoomName(roomId) {
        this.roomName.textContent = roomId;
    }

    // Afficher une modale (exemple : paramètres)
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    // Masquer une modale
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Gérer la fermeture des modales
    setupModalCloseButtons() {
        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }
}

// Exporter une instance unique du gestionnaire d'interface utilisateur
export default new UI();