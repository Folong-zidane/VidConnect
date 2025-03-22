#!/bin/bash

# Script d'installation pour AudioExchange

echo "Installation d'AudioExchange..."

# Installer les dépendances node pour le serveur de signalisation
echo "Installation des dépendances du serveur de signalisation..."
cd ../signaling-server
npm install

# Installer les dépendances pour le frontend
echo "Installation des dépendances frontend..."
cd ../frontend
npm install

# Retour au dossier de déploiement
cd ../deploy

# Lancer l'application avec Docker Compose
echo "Lancement des conteneurs Docker..."
docker-compose up -d

echo "Installation terminée. L'application est accessible à l'adresse http://localhost"