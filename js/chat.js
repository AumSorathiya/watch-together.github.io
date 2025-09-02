// Chat functionality with Firebase integration
import { 
    showToast, 
    escapeHtml, 
    linkifyText, 
    formatTimestamp,
    autoResizeTextarea,
    RateLimiter
} from './app.js';

export class ChatManager {
    constructor(db, roomId, userId, userName) {
        this.db = db;
        this.roomId = roomId;
        this.userId = userId;
        this.userName = userName;
        
        // Rate limiting (1 message per 800ms)
        this.rateLimiter = new RateLimiter(1, 800);
        
        // Typing indicator
        this.typingTimeout = null;
        this.isTyping = false;
        this.typingUsers = new Set();
        
        // Message limit per room
        this.maxMessages = 100;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setupFirebaseListeners();
        
        // Initialize emoji picker
        this.initEmojiPicker();
        
        // Load existing messages
        await this.loadMessages();
    }
    
    setupEventListeners() {
        // Chat input handlers
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message-btn');
        const mobileChatInput = document.getElementById('mobile-chat-input');
        const mobileSendButton = document.getElementById('mobile-send-btn');
        
        // Desktop chat
        chatInput.addEventListener('input', (e) => {
            this.handleInputChange(e.target);
            this.handleTyping();
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(chatInput.value);
                chatInput.value = '';
                autoResizeTextarea(chatInput);
            }
        });
        
        sendButton.addEventListener('click', () => {
            this.sendMessage(chatInput.value);
            chatInput.value = '';
            autoResizeTextarea(chatInput);
        });
        
        // Mobile chat
        if (mobileChatInput && mobileSendButton) {
            mobileChatInput.addEventListener('input', (e) => {
                this.handleInputChange(e.target);
                this.handleTyping();
            });
            
            mobileChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage(mobileChatInput.value);
                    mobileChatInput.value = '';
                    autoResizeTextarea(mobileChatInput);
                }
            });
            
            mobileSendButton.addEventListener('click', () => {
                this.sendMessage(mobileChatInput.value);
                mobileChatInput.value = '';
                autoResizeTextarea(mobileChatInput);
            });
        }
        
        // Clear chat (host only)
        document.getElementById('clear-chat-btn').addEventListener('click', () => {
            this.clearChat();
        });
        
        // Stop typing when input loses focus
        [chatInput, mobileChatInput].forEach(input => {
            if (input) {
                input.addEventListener('blur', () => {
                    this.stopTyping();
                });
            }
        });
    }
    
    async setupFirebaseListeners() {
        const { ref, onValue, query, orderByKey, limitToLast } = 
            await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        // Listen for new messages
        const messagesRef = ref(this.db, `rooms/${this.roomId}/chat`);
        const messagesQuery = query(messagesRef, orderByKey(), limitToLast(this.maxMessages));
        
        onValue(messagesQuery, (snapshot) => {
            const messages = snapshot.val();
            this.displayMessages(messages);
        });
        
        // Listen for typing indicators
        const typingRef = ref(this.db, `rooms/${this.roomId}/typing`);
        onValue(typingRef, (snapshot) => {
            const typingData = snapshot.val();
            this.updateTypingIndicator(typingData);
        });
    }
    
    handleInputChange(input) {
        const hasText = input.value.trim().length > 0;
        const sendButton = input.closest('.chat-input-container').querySelector('button');
        sendButton.disabled = !hasText;
    }
    
    handleTyping() {
        if (!this.isTyping) {
            this.startTyping();
        }
        
        // Reset typing timeout
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 2000);
    }
    
    async startTyping() {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        this.isTyping = true;
        const typingRef = ref(this.db, `rooms/${this.roomId}/typing/${this.userId}`);
        
        try {
            await set(typingRef, {
                name: this.userName,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to set typing status:', error);
        }
    }
    
    async stopTyping() {
        const { ref, remove } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        this.isTyping = false;
        clearTimeout(this.typingTimeout);
        
        const typingRef = ref(this.db, `rooms/${this.roomId}/typing/${this.userId}`);
        
        try {
            await remove(typingRef);
        } catch (error) {
            console.error('Failed to remove typing status:', error);
        }
    }
    
    async sendMessage(text) {
        text = text.trim();
        
        if (!text) return;
        
        if (text.length > 500) {
            showToast('Message too long (max 500 characters)', 'error');
            return;
        }
        
        // Check rate limit
        if (!this.rateLimiter.canMakeCall()) {
            const waitTime = Math.ceil(this.rateLimiter.getTimeUntilNextCall() / 1000);
            showToast(`Please wait ${waitTime}s before sending another message`, 'warning');
            return;
        }
        
        const { ref, push } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        const messagesRef = ref(this.db, `rooms/${this.roomId}/chat`);
        const message = {
            userId: this.userId,
            userName: this.userName,
            text: text,
            timestamp: Date.now()
        };
        
        try {
            await push(messagesRef, message);
            this.stopTyping();
        } catch (error) {
            console.error('Failed to send message:', error);
            showToast('Failed to send message', 'error');
        }
    }
    
    async clearChat() {
        if (!confirm('Are you sure you want to clear all messages?')) {
            return;
        }
        
        const { ref, remove } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        const chatRef = ref(this.db, `rooms/${this.roomId}/chat`);
        
        try {
            await remove(chatRef);
            showToast('Chat cleared', 'success');
        } catch (error) {
            console.error('Failed to clear chat:', error);
            showToast('Failed to clear chat', 'error');
        }
    }
    
    async loadMessages() {
        const { ref, get, query, orderByKey, limitToLast } = 
            await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        
        const messagesRef = ref(this.db, `rooms/${this.roomId}/chat`);
        const messagesQuery = query(messagesRef, orderByKey(), limitToLast(this.maxMessages));
        
        try {
            const snapshot = await get(messagesQuery);
            const messages = snapshot.val();
            this.displayMessages(messages);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }
    
    displayMessages(messagesData) {
        const chatMessages = document.getElementById('chat-messages');
        const mobileChatMessages = document.getElementById('mobile-chat-messages');
        
        if (!messagesData) {
            [chatMessages, mobileChatMessages].forEach(container => {
                if (container) container.innerHTML = '';
            });
            return;
        }
        
        const messages = Object.entries(messagesData)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        const messageHTML = messages.map(message => this.createMessageHTML(message)).join('');
        
        [chatMessages, mobileChatMessages].forEach(container => {
            if (container) {
                const wasAtBottom = this.isScrolledToBottom(container);
                container.innerHTML = messageHTML;
                
                if (wasAtBottom) {
                    this.scrollToBottom(container);
                }
            }
        });
    }
    
    createMessageHTML(message) {
        const escapedText = escapeHtml(message.text);
        const linkedText = linkifyText(escapedText);
        const timeString = formatTimestamp(message.timestamp);
        const isHost = message.userId === this.getHostId();
        
        return `
            <div class="chat-message">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(message.userName)}</span>
                    ${isHost ? '<span class="host-badge">HOST</span>' : ''}
                    <span class="message-time">${timeString}</span>
                </div>
                <div class="message-text">${linkedText}</div>
            </div>
        `;
    }
    
    updateTypingIndicator(typingData) {
        const typingIndicator = document.getElementById('typing-indicator');
        
        if (!typingData) {
            typingIndicator.classList.add('hidden');
            return;
        }
        
        // Filter out current user and old typing indicators
        const now = Date.now();
        const activeTyping = Object.entries(typingData)
            .filter(([userId, data]) => 
                userId !== this.userId && 
                data && 
                (now - data.timestamp) < 5000
            )
            .map(([userId, data]) => data.name);
        
        if (activeTyping.length === 0) {
            typingIndicator.classList.add('hidden');
            return;
        }
        
        let typingText;
        if (activeTyping.length === 1) {
            typingText = `${activeTyping[0]} is typing...`;
        } else if (activeTyping.length === 2) {
            typingText = `${activeTyping[0]} and ${activeTyping[1]} are typing...`;
        } else {
            typingText = `${activeTyping.slice(0, 2).join(', ')} and ${activeTyping.length - 2} others are typing...`;
        }
        
        typingIndicator.querySelector('span').textContent = typingText.split(' is typing...')[0];
        typingIndicator.classList.remove('hidden');
    }
    
    initEmojiPicker() {
        const emojiBtn = document.getElementById('emoji-btn');
        const emojiPicker = document.getElementById('emoji-picker');
        const closeEmojiPicker = document.getElementById('close-emoji-picker');
        const emojiButtons = document.querySelectorAll('.emoji-grid .emoji-btn');
        
        emojiBtn.addEventListener('click', () => {
            emojiPicker.showModal();
        });
        
        closeEmojiPicker.addEventListener('click', () => {
            emojiPicker.close();
        });
        
        emojiButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.textContent;
                this.insertEmoji(emoji);
                emojiPicker.close();
            });
        });
        
        // Close on backdrop click
        emojiPicker.addEventListener('click', (e) => {
            if (e.target === emojiPicker) {
                emojiPicker.close();
            }
        });
    }
    
    insertEmoji(emoji) {
        const chatInput = document.getElementById('chat-input');
        const mobileChatInput = document.getElementById('mobile-chat-input');
        
        // Determine which input is visible/active
        const activeInput = mobileChatInput && 
            !document.getElementById('mobile-chat-overlay').classList.contains('hidden') 
            ? mobileChatInput : chatInput;
        
        if (activeInput) {
            const cursorPos = activeInput.selectionStart;
            const textBefore = activeInput.value.substring(0, cursorPos);
            const textAfter = activeInput.value.substring(activeInput.selectionEnd);
            
            activeInput.value = textBefore + emoji + textAfter;
            activeInput.focus();
            activeInput.selectionStart = activeInput.selectionEnd = cursorPos + emoji.length;
            
            this.handleInputChange(activeInput);
            autoResizeTextarea(activeInput);
        }
    }
    
    getHostId() {
        // This would need to be passed from the room manager
        // For now, return null to avoid errors
        return null;
    }
    
    isScrolledToBottom(element) {
        return element.scrollHeight - element.clientHeight <= element.scrollTop + 1;
    }
    
    scrollToBottom(element) {
        element.scrollTop = element.scrollHeight;
    }
    
    destroy() {
        this.stopTyping();
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }
}
