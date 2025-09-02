# SyncWatch - Watch Videos Together

A static web application that allows people to watch videos together in perfect synchronization with real-time chat. Built with vanilla HTML, CSS, and JavaScript for deployment on GitHub Pages.

## Features

- 🎥 **Multi-platform video support**: YouTube, Vimeo, and direct MP4 URLs
- 🔄 **Real-time synchronization**: All viewers see the same content at the same time
- 💬 **Live chat**: Real-time messaging with typing indicators
- 👥 **User presence**: See who's online with avatars and viewer count
- 🎛️ **Host controls**: Room creator manages playback for everyone
- 📱 **Responsive design**: Works on desktop and mobile
- 🌙 **Dark/Light mode**: Toggle themes with preference memory
- ⌨️ **Keyboard shortcuts**: Space, arrows, and 'S' for sync
- 🔗 **Shareable rooms**: Short room IDs for easy sharing

## Quick Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Realtime Database**
4. Set database rules to:

```json
{
  "rules": {
    ".read": "auth == null",
    ".write": "auth == null"
  }
}
