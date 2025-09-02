// Video player abstraction supporting YouTube, Vimeo, and HTML5 video
export class VideoPlayer {
    constructor() {
        this.player = null;
        this.type = null;
        this.isReady_ = false;
        this.callbacks = {};
        this.container = document.getElementById('video-player');
        
        // State tracking
        this.currentTime = 0;
        this.duration = 0;
        this.playing = false;
        this.muted = false;
        this.volume = 0.5;
    }
    
    async loadVideo(type, url, callbacks = {}) {
        this.callbacks = callbacks;
        this.type = type;
        this.isReady_ = false;
        
        // Clear existing player
        if (this.player && this.player.destroy) {
            this.player.destroy();
        }
        this.container.innerHTML = '';
        
        switch (type) {
            case 'youtube':
                await this.loadYouTubeVideo(url);
                break;
            case 'vimeo':
                await this.loadVimeoVideo(url);
                break;
            case 'mp4':
                await this.loadMP4Video(url);
                break;
            default:
                throw new Error(`Unsupported video type: ${type}`);
        }
    }
    
    async loadYouTubeVideo(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }
        
        return new Promise((resolve, reject) => {
            // Wait for YouTube API to be ready
            const checkAPI = () => {
                if (window.YT && window.YT.Player) {
                    this.initYouTubePlayer(videoId, resolve, reject);
                } else {
                    setTimeout(checkAPI, 100);
                }
            };
            checkAPI();
        });
    }
    
    initYouTubePlayer(videoId, resolve, reject) {
        const playerDiv = document.createElement('div');
        playerDiv.id = 'youtube-player';
        this.container.appendChild(playerDiv);
        
        this.player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                controls: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0
            },
            events: {
                onReady: (event) => {
                    this.isReady_ = true;
                    this.duration = this.player.getDuration();
                    this.player.setVolume(this.volume * 100);
                    
                    if (this.callbacks.onReady) {
                        this.callbacks.onReady();
                    }
                    resolve();
                },
                onStateChange: (event) => {
                    const state = event.data;
                    
                    if (state === YT.PlayerState.PLAYING) {
                        this.playing = true;
                        if (this.callbacks.onPlay) {
                            this.callbacks.onPlay();
                        }
                    } else if (state === YT.PlayerState.PAUSED) {
                        this.playing = false;
                        if (this.callbacks.onPause) {
                            this.callbacks.onPause();
                        }
                    }
                },
                onError: (event) => {
                    reject(new Error(`YouTube error: ${event.data}`));
                }
            }
        });
        
        // Track seeking
        this.startTimeTracking();
    }
    
    async loadVimeoVideo(url) {
        const videoId = this.extractVimeoId(url);
        if (!videoId) {
            throw new Error('Invalid Vimeo URL');
        }
        
        return new Promise((resolve, reject) => {
            // Wait for Vimeo API to be ready
            const checkAPI = () => {
                if (window.Vimeo && window.Vimeo.Player) {
                    this.initVimeoPlayer(videoId, resolve, reject);
                } else {
                    setTimeout(checkAPI, 100);
                }
            };
            checkAPI();
        });
    }
    
    initVimeoPlayer(videoId, resolve, reject) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://player.vimeo.com/video/${videoId}?background=1&controls=0`;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.style.border = 'none';
        
        this.container.appendChild(iframe);
        
        this.player = new Vimeo.Player(iframe);
        
        this.player.ready().then(() => {
            this.isReady_ = true;
            
            return Promise.all([
                this.player.getDuration(),
                this.player.setVolume(this.volume)
            ]);
        }).then(([duration]) => {
            this.duration = duration;
            
            if (this.callbacks.onReady) {
                this.callbacks.onReady();
            }
            resolve();
        }).catch(reject);
        
        // Set up event listeners
        this.player.on('play', () => {
            this.playing = true;
            if (this.callbacks.onPlay) {
                this.callbacks.onPlay();
            }
        });
        
        this.player.on('pause', () => {
            this.playing = false;
            if (this.callbacks.onPause) {
                this.callbacks.onPause();
            }
        });
        
        this.player.on('seeked', (data) => {
            if (this.callbacks.onSeek) {
                this.callbacks.onSeek(data.seconds);
            }
        });
        
        this.player.on('error', (error) => {
            reject(error);
        });
    }
    
    async loadMP4Video(url) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = url;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.backgroundColor = '#000';
            video.preload = 'metadata';
            
            video.addEventListener('loadedmetadata', () => {
                this.isReady_ = true;
                this.duration = video.duration;
                video.volume = this.volume;
                
                if (this.callbacks.onReady) {
                    this.callbacks.onReady();
                }
                resolve();
            });
            
            video.addEventListener('play', () => {
                this.playing = true;
                if (this.callbacks.onPlay) {
                    this.callbacks.onPlay();
                }
            });
            
            video.addEventListener('pause', () => {
                this.playing = false;
                if (this.callbacks.onPause) {
                    this.callbacks.onPause();
                }
            });
            
            video.addEventListener('seeked', () => {
                if (this.callbacks.onSeek) {
                    this.callbacks.onSeek(video.currentTime);
                }
            });
            
            video.addEventListener('error', () => {
                reject(new Error('Failed to load video'));
            });
            
            this.player = video;
            this.container.appendChild(video);
        });
    }
    
    extractYouTubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/v\/([^&\n?#]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    
    extractVimeoId(url) {
        const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        return match ? match[1] : null;
    }
    
    startTimeTracking() {
        if (this.type === 'youtube') {
            // YouTube doesn't have a seeked event, so we track time changes
            let lastTime = 0;
            const trackTime = () => {
                if (this.isReady_ && this.player) {
                    const currentTime = this.player.getCurrentTime();
                    
                    if (Math.abs(currentTime - lastTime) > 1 && this.callbacks.onSeek) {
                        this.callbacks.onSeek(currentTime);
                    }
                    
                    lastTime = currentTime;
                    this.currentTime = currentTime;
                }
                
                if (this.type === 'youtube') {
                    requestAnimationFrame(trackTime);
                }
            };
            trackTime();
        }
    }
    
    async play() {
        if (!this.isReady_) return;
        
        switch (this.type) {
            case 'youtube':
                this.player.playVideo();
                break;
            case 'vimeo':
                await this.player.play();
                break;
            case 'mp4':
                await this.player.play();
                break;
        }
    }
    
    async pause() {
        if (!this.isReady_) return;
        
        switch (this.type) {
            case 'youtube':
                this.player.pauseVideo();
                break;
            case 'vimeo':
                await this.player.pause();
                break;
            case 'mp4':
                this.player.pause();
                break;
        }
    }
    
    async seek(time) {
        if (!this.isReady_) return;
        
        switch (this.type) {
            case 'youtube':
                this.player.seekTo(time, true);
                break;
            case 'vimeo':
                await this.player.setCurrentTime(time);
                break;
            case 'mp4':
                this.player.currentTime = time;
                break;
        }
        
        this.currentTime = time;
    }
    
    getCurrentTime() {
        if (!this.isReady_) return 0;
        
        switch (this.type) {
            case 'youtube':
                return this.player.getCurrentTime() || 0;
            case 'vimeo':
                // Vimeo getCurrentTime is async, so we track it
                return this.currentTime;
            case 'mp4':
                return this.player.currentTime || 0;
        }
        
        return 0;
    }
    
    getDuration() {
        return this.duration || 0;
    }
    
    isPlaying() {
        if (!this.isReady_) return false;
        
        switch (this.type) {
            case 'youtube':
                return this.player.getPlayerState() === YT.PlayerState.PLAYING;
            case 'vimeo':
            case 'mp4':
                return this.playing;
        }
        
        return false;
    }
    
    async setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (!this.isReady_) return;
        
        switch (this.type) {
            case 'youtube':
                this.player.setVolume(this.volume * 100);
                break;
            case 'vimeo':
                await this.player.setVolume(this.volume);
                break;
            case 'mp4':
                this.player.volume = this.volume;
                break;
        }
    }
    
    async toggleMute() {
        if (!this.isReady_) return;
        
        switch (this.type) {
            case 'youtube':
                if (this.player.isMuted()) {
                    this.player.unMute();
                    this.muted = false;
                } else {
                    this.player.mute();
                    this.muted = true;
                }
                break;
            case 'vimeo':
                const volume = await this.player.getVolume();
                if (volume > 0) {
                    this.volume = volume;
                    await this.player.setVolume(0);
                    this.muted = true;
                } else {
                    await this.player.setVolume(this.volume);
                    this.muted = false;
                }
                break;
            case 'mp4':
                this.player.muted = !this.player.muted;
                this.muted = this.player.muted;
                break;
        }
    }
    
    isMuted() {
        if (!this.isReady_) return false;
        
        switch (this.type) {
            case 'youtube':
                return this.player.isMuted();
            case 'vimeo':
            case 'mp4':
                return this.muted;
        }
        
        return false;
    }
    
    isReady() {
        return this.isReady_;
    }
    
    destroy() {
        if (this.player) {
            switch (this.type) {
                case 'youtube':
                    if (this.player.destroy) {
                        this.player.destroy();
                    }
                    break;
                case 'vimeo':
                    if (this.player.destroy) {
                        this.player.destroy();
                    }
                    break;
                case 'mp4':
                    this.player.remove();
                    break;
            }
        }
        
        this.container.innerHTML = '';
        this.player = null;
        this.isReady_ = false;
    }
}
