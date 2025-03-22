class RoomManager {
  constructor() {
    this.rooms = {}; // Stocker les informations des salles
  }

  // Créer une nouvelle salle si elle n'existe pas
  createRoom(roomId, creatorId, creatorUsername) {
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = {
        participants: {}, // Liste des participants dans la salle
        config: {
          teacherId: creatorId, // ID du créateur (enseignant)
          teacherName: creatorUsername, // Nom de l'enseignant
          allowStudentQuestions: true, // Autoriser les questions des étudiants
          chatEnabled: true, // Activer le chat
          recordingEnabled: false, // Enregistrement désactivé par défaut
          maxParticipants: 100, // Nombre maximum de participants
          createdAt: Date.now() // Date de création de la salle
        },
        messages: [], // Historique des messages du chat
        raisedHands: {}, // Liste des étudiants qui ont levé la main
        permissions: {} // Permissions spéciales (ex: qui peut parler)
      };
      
      // Ajouter l'enseignant comme premier participant
      this.rooms[roomId].participants[creatorId] = {
        username: creatorUsername,
        role: 'teacher', // Rôle : enseignant
        joinedAt: Date.now(),
        mediaState: {
          video: true, // Caméra activée par défaut pour l'enseignant
          audio: true, // Micro activé par défaut pour l'enseignant
          screen: false // Partage d'écran désactivé par défaut
        },
        isActive: true, // L'enseignant est actif par défaut
        canSpeak: true, // L'enseignant peut parler
        isMuted: false, // L'enseignant n'est pas mis en sourdine par défaut
      };
      
      return {
        success: true,
        role: 'teacher',
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false,
      message: "La salle existe déjà"
    };
  }

  // Ajouter un utilisateur à une salle
  joinRoom(roomId, socketId, username) {
    // Vérifier si la salle existe
    if (!this.rooms[roomId]) {
      return {
        success: false,
        message: "La salle n'existe pas"
      };
    }

    // Vérifier si la salle n'est pas pleine
    const participantCount = Object.keys(this.rooms[roomId].participants).length;
    if (participantCount >= this.rooms[roomId].config.maxParticipants) {
      return {
        success: false,
        message: "La salle est pleine"
      };
    }

    // Déterminer le rôle (enseignant si c'est le créateur, sinon étudiant)
    const isTeacher = (socketId === this.rooms[roomId].config.teacherId);
    const role = isTeacher ? 'teacher' : 'student';

    // Ajouter l'utilisateur à la salle avec des métadonnées
    this.rooms[roomId].participants[socketId] = {
      username: username,
      role: role,
      joinedAt: Date.now(),
      mediaState: {
        video: isTeacher, // Caméra activée par défaut pour l'enseignant uniquement
        audio: isTeacher, // Micro activé par défaut pour l'enseignant uniquement
        screen: false // Partage d'écran désactivé par défaut
      },
      isActive: true,
      canSpeak: isTeacher, // Seul l'enseignant peut parler par défaut
      isMuted: !isTeacher, // Les étudiants sont mis en sourdine par défaut
    };

    // Retourner les informations sur tous les participants et le rôle de l'utilisateur
    return {
      success: true,
      role: role,
      message: "Bienvenue dans la salle",
      roomInfo: this.getRoomInfo(roomId)
    };
  }

  // Obtenir les informations de la salle, incluant les participants
  getRoomInfo(roomId) {
    if (!this.rooms[roomId]) return null;

    return {
      roomId: roomId,
      participants: this.getParticipants(roomId),
      config: this.rooms[roomId].config,
      raisedHands: Object.keys(this.rooms[roomId].raisedHands).map(id => ({
        socketId: id,
        username: this.rooms[roomId].participants[id]?.username,
        timestamp: this.rooms[roomId].raisedHands[id]
      }))
    };
  }

  // Retirer un utilisateur d'une salle
  leaveRoom(roomId, socketId) {
    if (this.rooms[roomId] && this.rooms[roomId].participants[socketId]) {
      const userRole = this.rooms[roomId].participants[socketId].role;
      
      // Supprimer l'utilisateur
      delete this.rooms[roomId].participants[socketId];
      
      // Supprimer la main levée si existante
      if (this.rooms[roomId].raisedHands[socketId]) {
        delete this.rooms[roomId].raisedHands[socketId];
      }

      // Si c'était l'enseignant qui est parti
      if (userRole === 'teacher' && socketId === this.rooms[roomId].config.teacherId) {
        // Chercher un autre participant pour le promouvoir en enseignant
        const participants = this.getParticipants(roomId);
        if (participants.length > 0) {
          // Promouvoir le participant le plus ancien
          const oldestParticipant = participants.sort((a, b) => a.joinedAt - b.joinedAt)[0];
          this.rooms[roomId].config.teacherId = oldestParticipant.socketId;
          this.rooms[roomId].config.teacherName = oldestParticipant.username;
          
          // Mettre à jour son rôle
          this.rooms[roomId].participants[oldestParticipant.socketId].role = 'teacher';
          this.rooms[roomId].participants[oldestParticipant.socketId].canSpeak = true;
          this.rooms[roomId].participants[oldestParticipant.socketId].isMuted = false;
          
          return {
            success: true,
            newTeacher: oldestParticipant.socketId,
            message: "L'enseignant a quitté la salle, un nouveau a été désigné",
            roomInfo: this.getRoomInfo(roomId)
          };
        }
      }

      // Supprimer la salle si elle est vide
      if (Object.keys(this.rooms[roomId].participants).length === 0) {
        delete this.rooms[roomId];
        return {
          success: true,
          message: "La salle a été fermée car elle est vide",
          roomClosed: true
        };
      }

      return {
        success: true,
        message: "Vous avez quitté la salle",
        roomInfo: this.getRoomInfo(roomId)
      };
    }

    return {
      success: false,
      message: "Utilisateur ou salle non trouvé"
    };
  }

  // Obtenir tous les participants d'une salle
  getParticipants(roomId) {
    if (!this.rooms[roomId]) return [];

    return Object.keys(this.rooms[roomId].participants).map(socketId => ({
      socketId,
      ...this.rooms[roomId].participants[socketId]
    }));
  }

  // Vérifier si une salle existe
  roomExists(roomId) {
    return !!this.rooms[roomId];
  }

  // Obtenir un utilisateur spécifique
  getUser(roomId, socketId) {
    if (this.rooms[roomId] && this.rooms[roomId].participants[socketId]) {
      return {
        socketId,
        ...this.rooms[roomId].participants[socketId]
      };
    }
    return null;
  }

  // Vérifier si un utilisateur est l'enseignant de la salle
  isTeacher(roomId, socketId) {
    return this.rooms[roomId]?.config.teacherId === socketId;
  }

  // Lever la main (pour les étudiants)
  raiseHand(roomId, socketId) {
    if (this.rooms[roomId] && this.rooms[roomId].participants[socketId]) {
      // Vérifier que c'est un étudiant
      if (this.rooms[roomId].participants[socketId].role === 'student') {
        this.rooms[roomId].raisedHands[socketId] = Date.now();
        return {
          success: true,
          message: "Main levée",
          roomInfo: this.getRoomInfo(roomId)
        };
      }
      return {
        success: false,
        message: "Seuls les étudiants peuvent lever la main"
      };
    }
    return {
      success: false,
      message: "Utilisateur ou salle non trouvé"
    };
  }

  // Baisser la main
  lowerHand(roomId, socketId) {
    if (this.rooms[roomId] && this.rooms[roomId].raisedHands[socketId]) {
      delete this.rooms[roomId].raisedHands[socketId];
      return {
        success: true,
        message: "Main baissée",
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false, 
      message: "Main non levée ou salle non trouvée"
    };
  }

  // Autoriser un étudiant à parler (action de l'enseignant)
  grantSpeakPermission(roomId, teacherSocketId, studentSocketId) {
    // Vérifier que le demandeur est l'enseignant
    if (!this.isTeacher(roomId, teacherSocketId)) {
      return {
        success: false,
        message: "Seul l'enseignant peut accorder cette permission"
      };
    }

    if (this.rooms[roomId] && this.rooms[roomId].participants[studentSocketId]) {
      this.rooms[roomId].participants[studentSocketId].canSpeak = true;
      this.rooms[roomId].participants[studentSocketId].isMuted = false;
      
      // Supprimer de la liste des mains levées si présent
      if (this.rooms[roomId].raisedHands[studentSocketId]) {
        delete this.rooms[roomId].raisedHands[studentSocketId];
      }
      
      return {
        success: true,
        message: "Permission de parler accordée",
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false,
      message: "Étudiant non trouvé"
    };
  }

  // Révoquer le droit de parole d'un étudiant
  revokeSpeakPermission(roomId, teacherSocketId, studentSocketId) {
    // Vérifier que le demandeur est l'enseignant
    if (!this.isTeacher(roomId, teacherSocketId)) {
      return {
        success: false,
        message: "Seul l'enseignant peut révoquer cette permission"
      };
    }

    if (this.rooms[roomId] && this.rooms[roomId].participants[studentSocketId]) {
      this.rooms[roomId].participants[studentSocketId].canSpeak = false;
      this.rooms[roomId].participants[studentSocketId].isMuted = true;
      
      return {
        success: true,
        message: "Permission de parler révoquée",
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false,
      message: "Étudiant non trouvé"
    };
  }

  // Mettre à jour l'état média d'un utilisateur (caméra, micro, écran)
  updateUserMedia(roomId, socketId, mediaType, enabled) {
    if (this.rooms[roomId] && this.rooms[roomId].participants[socketId]) {
      // Pour la mise à jour du micro, vérifier les permissions
      if (mediaType === 'audio') {
        const participant = this.rooms[roomId].participants[socketId];
        
        // Si c'est un étudiant, vérifier qu'il a le droit de parler
        if (participant.role === 'student' && !participant.canSpeak && enabled) {
          return {
            success: false,
            message: "Vous n'avez pas la permission de parler"
          };
        }
      }
      
      this.rooms[roomId].participants[socketId].mediaState[mediaType] = enabled;
      return {
        success: true,
        message: `${mediaType} ${enabled ? 'activé' : 'désactivé'}`,
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false,
      message: "Utilisateur ou salle non trouvé"
    };
  }

  // Forcer la désactivation du média d'un utilisateur (par l'enseignant)
  forceMediaState(roomId, teacherSocketId, targetSocketId, mediaType, enabled) {
    // Vérifier que le demandeur est l'enseignant
    if (!this.isTeacher(roomId, teacherSocketId)) {
      return {
        success: false,
        message: "Seul l'enseignant peut forcer les états médias"
      };
    }

    if (this.rooms[roomId] && this.rooms[roomId].participants[targetSocketId]) {
      this.rooms[roomId].participants[targetSocketId].mediaState[mediaType] = enabled;
      
      // Si c'est le micro, mettre à jour les permissions également
      if (mediaType === 'audio') {
        this.rooms[roomId].participants[targetSocketId].canSpeak = enabled;
        this.rooms[roomId].participants[targetSocketId].isMuted = !enabled;
      }
      
      return {
        success: true,
        message: `${mediaType} ${enabled ? 'activé' : 'désactivé'} pour l'utilisateur`,
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false,
      message: "Utilisateur cible non trouvé"
    };
  }

  // Ajouter un message au chat
  addChatMessage(roomId, socketId, messageText, isQuestion = false) {
    if (this.rooms[roomId] && this.rooms[roomId].participants[socketId]) {
      const sender = this.rooms[roomId].participants[socketId];
      
      // Pour les questions, vérifier que les questions sont autorisées
      if (isQuestion && sender.role === 'student' && !this.rooms[roomId].config.allowStudentQuestions) {
        return {
          success: false,
          message: "Les questions des étudiants ne sont pas autorisées actuellement"
        };
      }
      
      const message = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        senderId: socketId,
        senderName: sender.username,
        senderRole: sender.role,
        text: messageText,
        isQuestion: isQuestion,
        timestamp: Date.now()
      };
      
      this.rooms[roomId].messages.push(message);
      
      // Limiter l'historique à 100 messages pour économiser la mémoire
      if (this.rooms[roomId].messages.length > 100) {
        this.rooms[roomId].messages.shift();
      }
      
      return {
        success: true,
        message: message
      };
    }
    return {
      success: false,
      message: "Utilisateur ou salle non trouvé"
    };
  }

  // Obtenir les messages du chat
  getChatMessages(roomId) {
    if (this.rooms[roomId]) {
      return this.rooms[roomId].messages;
    }
    return [];
  }

  // Mettre à jour la configuration de la salle (paramètres généraux)
  updateRoomConfig(roomId, teacherSocketId, configUpdates) {
    // Vérifier que le demandeur est l'enseignant
    if (!this.isTeacher(roomId, teacherSocketId)) {
      return {
        success: false,
        message: "Seul l'enseignant peut modifier la configuration"
      };
    }

    if (this.rooms[roomId]) {
      this.rooms[roomId].config = {
        ...this.rooms[roomId].config,
        ...configUpdates
      };
      return {
        success: true,
        message: "Configuration mise à jour",
        roomInfo: this.getRoomInfo(roomId)
      };
    }
    return {
      success: false,
      message: "Salle non trouvée"
    };
  }

  // Obtenir les statistiques d'une salle
  getRoomStats(roomId) {
    if (!this.rooms[roomId]) return null;

    const participants = this.rooms[roomId].participants;
    const participantCount = Object.keys(participants).length;
    
    let studentCount = 0;
    let activeVideoCount = 0;
    let activeAudioCount = 0;
    let raisedHandCount = Object.keys(this.rooms[roomId].raisedHands).length;
    
    for (const socketId in participants) {
      if (participants[socketId].role === 'student') studentCount++;
      if (participants[socketId].mediaState.video) activeVideoCount++;
      if (participants[socketId].mediaState.audio) activeAudioCount++;
    }
    
    return {
      participantCount,
      studentCount,
      activeVideoCount,
      activeAudioCount,
      raisedHandCount,
      roomAge: Date.now() - this.rooms[roomId].config.createdAt,
      messageCount: this.rooms[roomId].messages.length
    };
  }
}

// Exporter une instance unique du gestionnaire de salles
module.exports = new RoomManager();