# ClashStream

A YouTube music streaming web app that extracts and plays audio directly from YouTube using yt-dlp.

![ClashStream](https://via.placeholder.com/800x400?text=ClashStream+Music+Player)

## Features

- 🎵 **Stream YouTube Audio** - Search and play any song directly
- 🎨 **Glassmorphism UI** - Modern dark mode with neon accents
- 🔒 **Cookie Authentication** - Support for authenticated requests
- 🎛️ **Custom Audio Player** - Play/pause, seek, volume controls
- 🖼️ **Album Art Display** - High-res thumbnail from YouTube

## Prerequisites

### Install yt-dlp

yt-dlp is required for extracting audio streams from YouTube.

**Windows (using winget):**
```bash
winget install yt-dlp
```

**Windows (using Chocolatey):**
```bash
choco install yt-dlp
```

**Windows (using pip):**
```bash
pip install yt-dlp
```

**macOS (using Homebrew):**
```bash
brew install yt-dlp
```

**Linux (using pip):**
```bash
pip install yt-dlp
```

**Or download directly from GitHub:**
https://github.com/yt-dlp/yt-dlp/releases

> **Note:** Make sure `yt-dlp` is in your system PATH.

### Install FFmpeg (Recommended)

FFmpeg helps yt-dlp with audio processing.

**Windows:**
```bash
winget install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd clashstream
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **(Optional) Add cookies.txt for authentication:**
   
   If you encounter bot detection or age-restricted content, export your YouTube cookies:
   
   - Install a browser extension like "Get cookies.txt LOCALLY"
   - Go to youtube.com and export cookies
   - Save as `cookies.txt` in the project root

## Usage

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open in browser:**
   ```
   http://localhost:3000
   ```

3. **Search for a song** and enjoy streaming!

## Project Structure

```
clashstream/
├── server.js          # Express backend with yt-dlp integration
├── package.json       # Node.js dependencies
├── cookies.txt        # (Optional) YouTube cookies for auth
└── public/
    └── index.html     # Frontend with audio player
```

## API Endpoints

- `GET /search?query=<song name>` - Search YouTube and get audio stream URL
- `GET /stream/:videoId` - Get stream URL for specific video
- `GET /api/health` - Health check endpoint

## Troubleshooting

**"Unable to extract" errors:**
- Update yt-dlp: `pip install -U yt-dlp`
- Add cookies.txt for authentication

**No audio plays:**
- Check browser console for CORS errors
- Some videos may be geo-restricted

**Slow loading:**
- First search may take a few seconds as yt-dlp extracts the stream URL

## License

MIT
