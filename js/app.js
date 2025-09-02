// Shared utility functions and app initialization

// Toast notification system
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : 
                 type === 'error' ? '❌' : 
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Theme management
export function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');
    
    // Get saved theme or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (themeIcon) {
        themeIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    }
    
    // Theme toggle handler
    themeToggle?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (themeIcon) {
            themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
    });
}

// User name management
export function getUserName() {
    return localStorage.getItem('displayName') || null;
}

export function setUserName(name) {
    localStorage.setItem('displayName', name.trim());
}

// Room ID generation
export function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// URL validation
export function validateVideoUrl(url) {
    try {
        const urlObj = new URL(url);
        
        // YouTube patterns
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            return { type: 'youtube', url: cleanYouTubeUrl(url) };
        }
        
        // Vimeo patterns
        if (urlObj.hostname.includes('vimeo.com')) {
            return { type: 'vimeo', url: cleanVimeoUrl(url) };
        }
        
        // MP4 pattern
        if (url.toLowerCase().includes('.mp4') || urlObj.pathname.toLowerCase().endsWith('.mp4')) {
            return { type: 'mp4', url: url };
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

function cleanYouTubeUrl(url) {
    try {
        const urlObj = new URL(url);
        let videoId = '';
        
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.searchParams.has('v')) {
            videoId = urlObj.searchParams.get('v');
        }
        
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
    } catch (error) {
        // ignore
    }
    return url;
}

function cleanVimeoUrl(url) {
    try {
        const urlObj = new URL(url);
        const match = urlObj.pathname.match(/\/(\d+)/);
        if (match) {
            return `https://vimeo.com/${match[1]}`;
        }
    } catch (error) {
        // ignore
    }
    return url;
}

// Text utilities
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function linkifyText(text) {
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Firebase initialization check
export async function checkFirebaseConfig() {
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
        const config = await import('./firebase-config.js');
        return config.firebaseConfig && config.firebaseConfig.apiKey;
    } catch (error) {
        return false;
    }
}

// Landing page initialization
export async function initializeLanding() {
    // Initialize theme
    initTheme();
    
    // Check Firebase config
    const hasFirebase = await checkFirebaseConfig();
    if (!hasFirebase) {
        document.getElementById('setup-screen').classList.remove('hidden');
        return;
    }
    
    // Get DOM elements
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const nameModal = document.getElementById('name-modal');
    const displayNameInput = document.getElementById('display-name-input');
    const saveNameBtn = document.getElementById('save-name-btn');
    
    // Check if user has a name
    const userName = getUserName();
    if (!userName) {
        nameModal.classList.remove('hidden');
        displayNameInput.focus();
    }
    
    // Name modal handlers
    saveNameBtn.addEventListener('click', saveName);
    displayNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveName();
    });
    
    function saveName() {
        const name = displayNameInput.value.trim();
        if (name.length < 1) {
            showToast('Please enter a name', 'error');
            return;
        }
        if (name.length > 20) {
            showToast('Name must be 20 characters or less', 'error');
            return;
        }
        
        setUserName(name);
        nameModal.classList.add('hidden');
    }
    
    // Create room handler
    createRoomBtn.addEventListener('click', () => {
        if (!getUserName()) {
            nameModal.classList.remove('hidden');
            displayNameInput.focus();
            return;
        }
        
        const roomId = generateRoomId();
        window.location.href = `room.html?r=${roomId}`;
    });
    
    // Join room handlers
    joinRoomBtn.addEventListener('click', joinRoom);
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
    
    roomIdInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    
    function joinRoom() {
        if (!getUserName()) {
            nameModal.classList.remove('hidden');
            displayNameInput.focus();
            return;
        }
        
        const roomId = roomIdInput.value.trim();
        if (!roomId) {
            showToast('Please enter a room ID', 'error');
            return;
        }
        if (roomId.length !== 6) {
            showToast('Room ID must be 6 characters', 'error');
            return;
        }
        
        window.location.href = `room.html?r=${roomId}`;
    }
}

// Copy to clipboard utility
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

// Debounce utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Rate limiting utility
export class RateLimiter {
    constructor(maxCalls, timeWindow) {
        this.maxCalls = maxCalls;
        this.timeWindow = timeWindow;
        this.calls = [];
    }
    
    canMakeCall() {
        const now = Date.now();
        this.calls = this.calls.filter(call => now - call < this.timeWindow);
        
        if (this.calls.length < this.maxCalls) {
            this.calls.push(now);
            return true;
        }
        return false;
    }
    
    getTimeUntilNextCall() {
        if (this.calls.length < this.maxCalls) return 0;
        
        const oldestCall = Math.min(...this.calls);
        return this.timeWindow - (Date.now() - oldestCall);
    }
}

// URL parameter utility
export function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Generate user ID
export function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Auto-resize textarea
export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}
