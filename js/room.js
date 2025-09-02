// Main room functionality and coordination
import { 
    showToast, 
    initTheme, 
    getUserName, 
    validateVideoUrl,
    copyToClipboard,
    getUrlParameter,
    generateUserId,
    checkFirebaseConfig,
    autoResizeTextarea,
    debounce
} from './app.js';

import { VideoPlayer } from './video.js';
import { ChatManager } from './chat.js';
import { PresenceManager } from './presence.js';

class RoomManager {
    constructor() {
        this.roomId = null;
        this.userId = null;
        this.userName = null;
        this.isHost = false;
        this.db = null;
        this.videoPlayer = null;
        this.chatManager = null;
        this.presenceManager = null;
        
        // State management
        this.currentState = {
            url: '',
            time: 0,
            playing: false,
            updatedAt: 0,
            hostId: ''
        };
        
        // Sync management
        this.lastSyncTime = 0;
        this.syncInterval = null;
        this.isUpdatingFromRemote = false;
        
        // Debug mode
        this.debugMode = getUrlParameter('debug') === '1';
        
        this.init();
    }
    
    async init() {
        try {
            // Check Firebase config
            const hasFirebase = await checkFirebaseConfig();
            if (!hasFirebase) {
                document.getElementById('setup-screen').classList.remove('hidden');
                return;
            }
            
            // Initialize Firebase
            await this.initFirebase();
            
            // Initialize theme
            initTheme();
            
            // Get room ID from URL
            this.roomId = getUrlParameter('r');
            if (!this.roomId) {
                showToast('Invalid room URL', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }
            
            // Get user info
            this.userName = getUserName();
            if (!this.userName) {
                window.location.href = 'index.html';
                return;
            }
            
            this.userId = generateUserId();
            
            // Initialize UI
            this.initUI();
            
            // Initialize managers
            this.videoPlayer = new VideoPlayer();
            this.chatManager = new ChatManager(this.db, this.roomId, this.userId, this.userName);
            this.presenceManager = new PresenceManager(this.db, this.roomId, this.userId, this.userName);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Connect to room
            await this.connectToRoom();
            
            // Start sync interval
            this.startSyncInterval();
            
            // Show debug panel if enabled
            if (this.debugMode) {
                document.getElementById('debug-panel').classList.remove('hidden');
                this.updateDebugInfo();
            }
            
            showToast(`Joined room ${this.roomId}`, 'success');
            
        } catch (error) {
            console.error('Failed to initialize room:', error);
            showToast('Failed to connect to room', 'error');
        }
    }
    
    async initFirebase() {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
        const { getDatabase } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        const { firebaseConfig } = await import('./firebase-config.js');
        
        const app = initializeApp(firebaseConfig);
        this.db = getDatabase(app);
    }
    
    initUI() {
        // Set room ID in header
        document.getElementById('room-id-display').textContent = this.roomId;
        
        // Initialize video player placeholder
        this.updateVideoPlaceholder();
        
        // Auto-resize chat input
        const chatInput = document.getElementById('chat-input');
        const mobileChatInput = document.getElementById('mobile-chat-input');
        
        [chatInput, mobileChatInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => autoResizeTextarea(input));
            }
        });
    }
    
    setupEventListeners() {
        // Copy room link
        document.getElementById('copy-link-btn').addEventListener('click', async () => {
            const link = `${window.location.origin}/room.html?r=${this.roomId}`;
            const success = await copyToClipboard(link);
            showToast(success ? 'Room link copied!' : 'Failed to copy link', success ? 'success' : 'error');
        });
        
        // Video controls
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            if (this.isHost) {
                this.videoPlayer.isPlaying() ? this.pause() : this.play();
            }
        });
        
        document.getElementById('mute-btn').addEventListener('click', () => {
            this.videoPlayer.toggleMute();
            this.updateMuteButton();
        });
        
        // Seek slider
        const seekSlider = document.getElementById('seek-slider');
        seekSlider.addEventListener('input', debounce((e) => {
            if (this.isHost) {
                const time = (e.target.value / 100) * this.videoPlayer.getDuration();
                this.seek(time);
            }
        }, 300));
        
        // Volume slider
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.videoPlayer.setVolume(e.target.value / 100);
        });
        
        // Sync button
        document.getElementById('sync-btn').addEventListener('click', () => {
            this.syncToRemoteState(true);
        });
        
        // Load video (host only)
        document.getElementById('load-video-btn').addEventListener('click', () => {
            this.loadVideoFromInput();
        });
        
        document.getElementById('video-url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadVideoFromInput();
            }
        });
        
        // Demo video button
        document.getElementById('demo-video-btn').addEventListener('click', () => {
            if (this.isHost) {
                const demoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
                this.loadVideo(demoUrl);
            } else {
                showToast('Only the host can load videos', 'warning');
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    if (this.isHost) {
                        this.videoPlayer.isPlaying() ? this.pause() : this.play();
                    }
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    if (this.isHost) {
                        const currentTime = this.videoPlayer.getCurrentTime();
                        this.seek(Math.max(0, currentTime - 5));
                    }
                    break;
                case 'arrowright':
                    e.preventDefault();
                    if (this.isHost) {
                        const currentTime = this.videoPlayer.getCurrentTime();
                        const duration = this.videoPlayer.getDuration();
                        this.seek(Math.min(duration, currentTime + 5));
                    }
                    break;
                case 's':
                    e.preventDefault();
                    this.syncToRemoteState(true);
                    break;
            }
        });
        
        // Mobile chat toggle
        document.getElementById('toggle-chat-btn')?.addEventListener('click', () => {
            document.getElementById('mobile-chat-overlay').classList.remove('hidden');
        });
        
        document.getElementById('close-mobile-chat')?.addEventListener('click', () => {
            document.getElementById('mobile-chat-overlay').classList.add('hidden');
        });
    }
    
    async connectToRoom() {
        const { ref, onValue, push, set, onDisconnect } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        // Check if room exists and get current state
        const roomStateRef = ref(this.db, `rooms/${this.roomId}/state`);
        
        onValue(roomStateRef, (snapshot) => {
            const state = snapshot.val();
            
            if (!state) {
                // Room doesn't exist, create it and become host
                this.becomeHost();
            } else {
                // Room exists, sync to current state
                this.currentState = state;
                this.isHost = state.hostId === this.userId;
                
                if (this.currentState.url) {
                    this.loadVideo(this.currentState.url, false);
                }
                
                this.syncToRemoteState();
                this.updateHostUI();
            }
        });
        
        // Set up presence
        this.presenceManager.connect();
        
        // Listen for host changes
        this.presenceManager.onHostChange((newHostId) => {
            const wasHost = this.isHost;
            this.isHost = newHostId === this.userId;
            
            if (!wasHost && this.isHost) {
                showToast('You are now the host', 'success');
            } else if (wasHost && !this.isHost) {
                showToast('Host privileges transferred', 'warning');
            }
            
            this.updateHostUI();
        });
    }
    
    async becomeHost() {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        this.isHost = true;
        this.currentState.hostId = this.userId;
        
        const roomStateRef = ref(this.db, `rooms/${this.roomId}/state`);
        await set(roomStateRef, this.currentState);
        
        this.updateHostUI();
        showToast('You are the host', 'success');
    }
    
    updateHostUI() {
        const body = document.body;
        const hostControls = document.getElementById('host-controls');
        const clearChatBtn = document.getElementById('clear-chat-btn');
        
        if (this.isHost) {
            body.classList.add('is-host');
            hostControls.classList.remove('hidden');
            clearChatBtn.classList.remove('hidden');
        } else {
            body.classList.remove('is-host');
            hostControls.classList.add('hidden');
            clearChatBtn.classList.add('hidden');
        }
        
        // Update debug info
        if (this.debugMode) {
            document.getElementById('debug-role').textContent = this.isHost ? 'Host' : 'Client';
        }
    }
    
    loadVideoFromInput() {
        if (!this.isHost) {
            showToast('Only the host can load videos', 'warning');
            return;
        }
        
        const urlInput = document.getElementById('video-url-input');
        const url = urlInput.value.trim();
        
        if (!url) {
            showToast('Please enter a video URL', 'error');
            return;
        }
        
        this.loadVideo(url);
        urlInput.value = '';
    }
    
    async loadVideo(url, updateState = true) {
        const validatedUrl = validateVideoUrl(url);
        
        if (!validatedUrl) {
            showToast('Invalid video URL. Please use YouTube, Vimeo, or MP4 links.', 'error');
            return;
        }
        
        try {
            await this.videoPlayer.loadVideo(validatedUrl.type, validatedUrl.url, {
                onReady: () => {
                    this.updateVideoControls();
                    this.updateVideoPlaceholder(false);
                    
                    if (updateState && this.isHost) {
                        this.updateRoomState({
                            url: validatedUrl.url,
                            time: 0,
                            playing: false
                        });
                    }
                },
                onPlay: () => {
                    if (this.isHost && !this.isUpdatingFromRemote) {
                        this.updateRoomState({ playing: true });
                    }
                    this.updatePlayPauseButton(true);
                },
                onPause: () => {
                    if (this.isHost && !this.isUpdatingFromRemote) {
                        this.updateRoomState({ playing: false });
                    }
                    this.updatePlayPauseButton(false);
                },
                onSeek: (time) => {
                    if (this.isHost && !this.isUpdatingFromRemote) {
                        this.updateRoomState({ time });
                    }
                }
            });
            
            showToast(`Video loaded: ${validatedUrl.type.toUpperCase()}`, 'success');
            
        } catch (error) {
            console.error('Failed to load video:', error);
            showToast('Failed to load video', 'error');
        }
    }
    
    async updateRoomState(updates) {
        if (!this.isHost) return;
        
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        const newState = {
            ...this.currentState,
            ...updates,
            updatedAt: Date.now(),
            hostId: this.userId
        };
        
        this.currentState = newState;
        this.lastSyncTime = Date.now();
        
        const roomStateRef = ref(this.db, `rooms/${this.roomId}/state`);
        await update(roomStateRef, newState);
    }
    
    async play() {
        if (!this.isHost) return;
        
        await this.videoPlayer.play();
        await this.updateRoomState({
            playing: true,
            time: this.videoPlayer.getCurrentTime()
        });
    }
    
    async pause() {
        if (!this.isHost) return;
        
        await this.videoPlayer.pause();
        await this.updateRoomState({
            playing: false,
            time: this.videoPlayer.getCurrentTime()
        });
    }
    
    async seek(time) {
        if (!this.isHost) return;
        
        await this.videoPlayer.seek(time);
        await this.updateRoomState({
            time,
            playing: this.videoPlayer.isPlaying()
        });
    }
    
    syncToRemoteState(force = false) {
        if (this.isHost || !this.currentState.url || !this.videoPlayer.isReady()) return;
        
        const timeSinceUpdate = Date.now() - this.currentState.updatedAt;
        if (timeSinceUpdate > 10000 && !force) return; // Ignore old updates
        
        this.isUpdatingFromRemote = true;
        
        const remoteTime = this.currentState.time + (timeSinceUpdate / 1000);
        const localTime = this.videoPlayer.getCurrentTime();
        const drift = Math.abs(remoteTime - localTime);
        
        // Sync if drift is significant or forced
        if (drift > 0.4 || force) {
            this.videoPlayer.seek(remoteTime);
            
            if (force) {
                showToast('Synced with host', 'success');
            }
        }
        
        // Sync play/pause state
        const shouldBePlaying = this.currentState.playing;
        const isPlaying = this.videoPlayer.isPlaying();
        
        if (shouldBePlaying && !isPlaying) {
            this.videoPlayer.play();
        } else if (!shouldBePlaying && isPlaying) {
            this.videoPlayer.pause();
        }
        
        this.isUpdatingFromRemote = false;
        
        // Update debug info
        if (this.debugMode) {
            this.updateDebugInfo(drift);
        }
    }
    
    startSyncInterval() {
        this.syncInterval = setInterval(() => {
            this.syncToRemoteState();
            this.updateVideoProgress();
        }, 5000);
    }
    
    updateVideoControls() {
        const duration = this.videoPlayer.getDuration();
        
        // Enable controls
        document.getElementById('play-pause-btn').disabled = false;
        document.getElementById('seek-slider').disabled = false;
        document.getElementById('mute-btn').disabled = false;
        document.getElementById('volume-slider').disabled = false;
        
        // Update duration display
        document.getElementById('duration').textContent = this.formatTime(duration);
    }
    
    updateVideoProgress() {
        if (!this.videoPlayer.isReady()) return;
        
        const currentTime = this.videoPlayer.getCurrentTime();
        const duration = this.videoPlayer.getDuration();
        
        // Update time display
        document.getElementById('current-time').textContent = this.formatTime(currentTime);
        
        // Update seek slider
        const progress = duration ? (currentTime / duration) * 100 : 0;
        document.getElementById('seek-slider').value = progress;
    }
    
    updatePlayPauseButton(playing) {
        const icon = document.querySelector('#play-pause-btn .control-icon');
        icon.textContent = playing ? '⏸️' : '▶️';
    }
    
    updateMuteButton() {
        const icon = document.querySelector('#mute-btn .control-icon');
        icon.textContent = this.videoPlayer.isMuted() ? '🔇' : '🔊';
    }
    
    updateVideoPlaceholder(show = true) {
        const placeholder = document.querySelector('.no-video-placeholder');
        if (placeholder) {
            placeholder.style.display = show ? 'flex' : 'none';
        }
    }
    
    updateDebugInfo(drift = null) {
        if (!this.debugMode) return;
        
        document.getElementById('debug-role').textContent = this.isHost ? 'Host' : 'Client';
        document.getElementById('debug-local-time').textContent = 
            this.videoPlayer.isReady() ? this.formatTime(this.videoPlayer.getCurrentTime()) : '-';
        document.getElementById('debug-remote-time').textContent = 
            this.currentState.url ? this.formatTime(this.currentState.time) : '-';
        document.getElementById('debug-drift').textContent = 
            drift !== null ? `${drift.toFixed(2)}s` : '-';
        document.getElementById('debug-status').textContent = 
            this.videoPlayer.isReady() ? (this.videoPlayer.isPlaying() ? 'Playing' : 'Paused') : 'No video';
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.videoPlayer) {
            this.videoPlayer.destroy();
        }
        
        if (this.chatManager) {
            this.chatManager.destroy();
        }
        
        if (this.presenceManager) {
            this.presenceManager.destroy();
        }
    }
}

// Initialize room when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RoomManager();
});
