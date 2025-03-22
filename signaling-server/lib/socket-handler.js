function initialize(io, roomManager) {
    io.on('connection', (socket) => {
        console.log(`Nouvelle connexion: ${socket.id}`);

        // Rejoindre une salle
        socket.on('join-room', (data, callback) => {
            const { roomId, username, isTeacher } = data;

            console.log(`Utilisateur ${username} tente de rejoindre la salle ${roomId}`);

            // Ajouter l'utilisateur à la salle
            const result = roomManager.joinRoom(roomId, {
                socketId: socket.id,
                username: username || 'Utilisateur',
                isTeacher: isTeacher || false
            });

            // Rejoindre la salle Socket.IO
            socket.join(roomId);

            // Stocker l'ID de la salle dans l'objet socket
            socket.roomId = roomId;

            // Renvoyer une réponse au client
            if (typeof callback === 'function') {
                callback({
                    success: true,
                    message: 'Salle rejointe',
                    participants: result.participants
                });
            } else {
                console.error('Callback non fourni ou invalide');
            }

            // Informer les autres participants de la salle
            socket.to(roomId).emit('user-joined', {
                socketId: socket.id,
                username: username || 'Utilisateur'
            });

            console.log(`Utilisateur ${socket.id} a rejoint la salle ${roomId}`);
        });

        // Gérer les signaux WebRTC
        socket.on('webrtc-signal', (data) => {
            const { roomId, target, signal } = data;

            // Transmettre le signal au destinataire
            socket.to(target).emit('webrtc-signal', {
                from: socket.id,
                signal
            });
        });

        // Déconnexion
        socket.on('disconnect', () => {
            const roomId = socket.roomId;

            if (roomId) {
                // Retirer l'utilisateur de la salle
                roomManager.leaveRoom(roomId, socket.id);

                // Informer les autres participants
                socket.to(roomId).emit('user-left', {
                    socketId: socket.id
                });

                console.log(`Utilisateur ${socket.id} a quitté la salle ${roomId}`);
            }

            console.log(`Déconnexion: ${socket.id}`);
        });
    });
}

module.exports = { initialize };