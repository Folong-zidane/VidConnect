document.addEventListener('DOMContentLoaded', () => {
    const chatBtn = document.getElementById('chat-btn');
    const chatContainer = document.getElementById('chat-container');
    const closeChat = document.querySelector('.close-chat');
    const raiseHandBtn = document.getElementById('raise-hand-btn');

    // Create chat overlay
    const chatOverlay = document.createElement('div');
    chatOverlay.classList.add('chat-overlay');
    document.body.appendChild(chatOverlay);

    // Chat interaction
    chatBtn.addEventListener('click', () => {
        chatContainer.classList.add('open');
        chatOverlay.classList.add('active');
    });

    closeChat.addEventListener('click', () => {
        chatContainer.classList.remove('open');
        chatOverlay.classList.remove('active');
    });

    // Close chat when clicking outside
    chatOverlay.addEventListener('click', (e) => {
        if (e.target === chatOverlay) {
            chatContainer.classList.remove('open');
            chatOverlay.classList.remove('active');
        }
    });

    // Raise hand interaction
    raiseHandBtn.addEventListener('click', () => {
        raiseHandBtn.classList.toggle('hand-raised');
        
        // Add a badge to indicate hand is raised
        if (raiseHandBtn.classList.contains('hand-raised')) {
            const badge = document.createElement('div');
            badge.classList.add('hand-raised-badge');
            badge.textContent = '✋';
            raiseHandBtn.appendChild(badge);
        } else {
            const badge = raiseHandBtn.querySelector('.hand-raised-badge');
            if (badge) badge.remove();
        }
    });
});