# Overview

SyncWatch is a static web application that enables synchronized video watching with real-time chat functionality. Built entirely with vanilla HTML, CSS, and JavaScript, it's designed for deployment on GitHub Pages without requiring a custom backend. The application supports multiple video platforms (YouTube, Vimeo, MP4) and provides seamless real-time synchronization across all viewers in a room.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Static Web Application**: Built with vanilla HTML, CSS, and JavaScript for GitHub Pages deployment
- **Module-based JavaScript**: ES6 modules organize functionality into distinct components (room management, video handling, chat, presence)
- **Responsive Design**: CSS Grid and Flexbox layout with mobile-first approach and theme support (light/dark mode)
- **Component Separation**: Clear separation between video player abstraction, chat system, presence management, and room coordination

## Video Player System
- **Multi-platform Support**: Abstracted video player supporting YouTube (iframe API), Vimeo (player API), and HTML5 video for MP4
- **Synchronization Engine**: Real-time sync with debounced seek operations and drift reconciliation every 5 seconds
- **Host-controlled Playback**: Only room hosts can control video playback, with automatic time synchronization for late joiners
- **State Management**: Centralized video state tracking (time, playing status, URL) synchronized across all clients

## Real-time Communication
- **Firebase Realtime Database**: Handles all real-time synchronization for video controls, chat messages, and user presence
- **Presence System**: Tracks online users with heartbeat mechanism and automatic cleanup on disconnect
- **Chat System**: Real-time messaging with typing indicators, emoji support, and message persistence (last 100 messages per room)
- **Host Management**: Dynamic host assignment with transfer capabilities and permission-based controls

## Room Management
- **URL-based Routing**: Rooms accessible via shareable URLs with short room IDs
- **Client-side State**: localStorage for user preferences, display names, and theme settings
- **No Authentication**: Open rooms with optional display names for simplicity

## Data Flow
- **Unidirectional Sync**: Host controls propagate to all viewers through Firebase
- **Event-driven Architecture**: Firebase listeners trigger UI updates and state changes
- **Rate Limiting**: Chat rate limiting and debounced video sync to prevent spam and excessive API calls

# External Dependencies

## Firebase Services
- **Firebase Realtime Database**: Primary backend for all real-time data synchronization
- **Firebase SDK**: Version 9.22.0 loaded via CDN for database operations and presence management
- **Database Rules**: Configured for public read/write access (no authentication required)

## Video Platform APIs
- **YouTube IFrame API**: For YouTube video embedding and control
- **Vimeo Player API**: For Vimeo video embedding and synchronization
- **HTML5 Video**: Native browser support for MP4 video playback

## Browser APIs
- **LocalStorage**: User preferences and session data persistence
- **Clipboard API**: Room link copying functionality
- **MediaQuery API**: Theme preference detection and responsive behavior
- **Intersection Observer**: Performance optimization for chat scrolling

## Development Dependencies
- **ES6 Modules**: Native browser module support for code organization
- **CSS Custom Properties**: For theming and responsive design
- **GitHub Pages**: Static hosting platform for deployment