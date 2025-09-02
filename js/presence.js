// User presence and host management
export class PresenceManager {
    constructor(db, roomId, userId, userName) {
        this.db = db;
        this.roomId = roomId;
        this.userId = userId;
        this.userName = userName;
        
        this.users = new Map();
        this.hostId = null;
        this.onHostChangeCallback = null;
        
        // Heartbeat interval
        this.heartbeatInterval = null;
    }
    
    async connect() {
        const { ref, set, onDisconnect, onValue, serverTimestamp } = 
            await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        // Set up presence
        const presenceRef = ref(this.db, `rooms/${this.roomId}/presence/${this.userId}`);
        const userData = {
            name: this.userName,
            joinedAt: Date.now(),
            lastSeen: serverTimestamp()
        };
        
        // Set user as online
        await set(presenceRef, userData);
        
        // Remove user when disconnected
        await onDisconnect(presenceRef).remove();
        
        // Listen for presence changes
        const allPresenceRef = ref(this.db, `rooms/${this.roomId}/presence`);
        onValue(allPresenceRef, (snapshot) => {
            this.updatePresence(snapshot.val());
        });
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Show join toast
        this.showJoinToast();
    }
    
    async startHeartbeat() {
        const { ref, update, serverTimestamp } = 
            await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        this.heartbeatInterval = setInterval(async () => {
            const presenceRef = ref(this.db, `rooms/${this.roomId}/presence/${this.userId}`);
            try {
                await update(presenceRef, {
                    lastSeen: serverTimestamp()
                });
            } catch (error) {
                console.error('Heartbeat failed:', error);
            }
        }, 30000); // 30 seconds
    }
    
    updatePresence(presenceData) {
        const previousUsers = new Map(this.users);
        this.users.clear();
        
        if (!presenceData) {
            this.updateUI();
            return;
        }
        
        const now = Date.now();
        const timeoutMs = 60000; // 1 minute timeout
        
        // Filter out stale presence data
        Object.entries(presenceData).forEach(([userId, userData]) => {
            if (!userData) return;
            
            const lastSeen = userData.lastSeen || userData.joinedAt || now;
            const timeSinceLastSeen = now - lastSeen;
            
            // Only include users seen recently
            if (timeSinceLastSeen < timeoutMs) {
                this.users.set(userId, {
                    ...userData,
                    isOnline: timeSinceLastSeen < 35000 // 35 seconds
                });
            }
        });
        
        // Determine host
        this.updateHost();
        
        // Show join/leave toasts
        this.showPresenceChanges(previousUsers);
        
        // Update UI
        this.updateUI();
    }
    
    updateHost() {
        const onlineUsers = Array.from(this.users.entries())
            .filter(([, userData]) => userData.isOnline)
            .sort(([, a], [, b]) => a.joinedAt - b.joinedAt);
        
        const newHostId = onlineUsers.length > 0 ? onlineUsers[0][0] : null;
        
        if (newHostId !== this.hostId) {
            const previousHostId = this.hostId;
            this.hostId = newHostId;
            
            // Update room state with new host
            this.updateRoomHost(newHostId);
            
            // Notify about host change
            if (this.onHostChangeCallback) {
                this.onHostChangeCallback(newHostId, previousHostId);
            }
        }
    }
    
    async updateRoomHost(newHostId) {
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        const roomStateRef = ref(this.db, `rooms/${this.roomId}/state`);
        try {
            await update(roomStateRef, {
                hostId: newHostId,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error('Failed to update room host:', error);
        }
    }
    
    showPresenceChanges(previousUsers) {
        // Import showToast dynamically
        import('./app.js').then(({ showToast }) => {
            this.handlePresenceChanges(previousUsers, showToast);
        });
    }
    
    handlePresenceChanges(previousUsers, showToast) {
        
        // Find new joins
        this.users.forEach((userData, userId) => {
            if (!previousUsers.has(userId) && userId !== this.userId) {
                showToast(`${userData.name} joined the room`, 'success', 2000);
            }
        });
        
        // Find leaves
        previousUsers.forEach((userData, userId) => {
            if (!this.users.has(userId) && userId !== this.userId) {
                showToast(`${userData.name} left the room`, 'warning', 2000);
            }
        });
    }
    
    showJoinToast() {
        // Import showToast dynamically
        import('./app.js').then(({ showToast }) => {
            this.handleJoinToast(showToast);
        });
    }
    
    handleJoinToast(showToast) {
        
        // Delay to avoid showing toast for initial load
        setTimeout(() => {
            const onlineCount = Array.from(this.users.values())
                .filter(user => user.isOnline).length;
            
            if (onlineCount > 1) {
                showToast(`${onlineCount} users in room`, 'info', 2000);
            }
        }, 1000);
    }
    
    updateUI() {
        this.updateViewersCount();
        this.updateUserAvatars();
    }
    
    updateViewersCount() {
        const viewersCount = document.getElementById('viewers-count');
        if (!viewersCount) return;
        
        const onlineUsers = Array.from(this.users.values())
            .filter(user => user.isOnline);
        
        viewersCount.textContent = onlineUsers.length;
    }
    
    updateUserAvatars() {
        const avatarsContainer = document.getElementById('user-avatars');
        if (!avatarsContainer) return;
        
        const onlineUsers = Array.from(this.users.entries())
            .filter(([, userData]) => userData.isOnline)
            .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
            .slice(0, 6); // Limit to 6 avatars
        
        avatarsContainer.innerHTML = onlineUsers.map(([userId, userData]) => {
            const initials = this.getInitials(userData.name);
            const isHost = userId === this.hostId;
            const backgroundColor = this.getUserColor(userId);
            
            return `
                <div class="user-avatar ${isHost ? 'host' : ''}" 
                     style="background-color: ${backgroundColor}" 
                     title="${userData.name}${isHost ? ' (Host)' : ''}">
                    ${initials}
                </div>
            `;
        }).join('');
        
        // Show overflow count if there are more users
        const totalOnline = Array.from(this.users.values())
            .filter(user => user.isOnline).length;
        
        if (totalOnline > 6) {
            avatarsContainer.innerHTML += `
                <div class="user-avatar" style="background-color: #718096" title="${totalOnline - 6} more users">
                    +${totalOnline - 6}
                </div>
            `;
        }
    }
    
    getInitials(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('')
            .substring(0, 2);
    }
    
    getUserColor(userId) {
        // Generate consistent color for user based on ID
        const colors = [
            '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795',
            '#3182ce', '#553c9a', '#805ad5', '#b83280', '#ec4899'
        ];
        
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    onHostChange(callback) {
        this.onHostChangeCallback = callback;
    }
    
    isHost(userId = null) {
        const checkUserId = userId || this.userId;
        return checkUserId === this.hostId;
    }
    
    getHostId() {
        return this.hostId;
    }
    
    getOnlineUsers() {
        return Array.from(this.users.values())
            .filter(user => user.isOnline);
    }
    
    destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Remove presence on cleanup
        this.removePresence();
    }
    
    async removePresence() {
        const { ref, remove } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        const presenceRef = ref(this.db, `rooms/${this.roomId}/presence/${this.userId}`);
        try {
            await remove(presenceRef);
        } catch (error) {
            console.error('Failed to remove presence:', error);
        }
    }
}
