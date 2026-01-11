const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const http = require('http');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

console.log('🎵 ClashStream running in cookie-less mode');

// Cache for stream URLs (they expire quickly)
const urlCache = new Map();

// Helper function to run yt-dlp (no cookies needed)
async function runYtDlp(args) {
    // Add headers to avoid bot detection
    const headers = '--add-header "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"';
    const cmd = `yt-dlp ${headers} --no-check-certificates ${args}`;
    console.log(`Running: yt-dlp ${args.substring(0, 60)}...`);

    try {
        const { stdout } = await execPromise(cmd, {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 60000
        });
        return stdout.trim();
    } catch (error) {
        console.error('yt-dlp error:', error.message);
        throw error;
    }
}

// Search endpoint - returns metadata and a proxy URL
app.get('/search', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        console.log(`Searching for: ${query}`);
        const searchQuery = `ytsearch1:${query}`;

        // Get metadata
        const metadataJson = await runYtDlp(
            `--dump-single-json --no-warnings "${searchQuery}"`
        );

        const metadata = JSON.parse(metadataJson);

        if (!metadata) {
            throw new Error('No results found');
        }

        // Get direct audio URL
        const audioUrl = await runYtDlp(
            `-g -f "bestaudio" --no-warnings "${searchQuery}"`
        );

        if (!audioUrl) {
            throw new Error('Could not extract audio URL');
        }

        // Generate a unique ID for this stream and cache it
        const streamId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        urlCache.set(streamId, {
            url: audioUrl.split('\n')[0],
            expires: Date.now() + 3600000  // 1 hour expiry
        });

        // Clean up old cache entries
        for (const [key, value] of urlCache) {
            if (value.expires < Date.now()) {
                urlCache.delete(key);
            }
        }

        // Get best thumbnail
        const thumbnail = metadata.thumbnail ||
            (metadata.thumbnails && metadata.thumbnails.length > 0
                ? metadata.thumbnails[metadata.thumbnails.length - 1].url
                : '');

        console.log(`Found: ${metadata.title} (stream: ${streamId})`);

        res.json({
            id: metadata.id,
            title: metadata.title || 'Unknown Track',
            thumbnail: thumbnail ? `/thumbnail/${encodeURIComponent(thumbnail)}` : '',
            audioUrl: `/proxy/${streamId}`,  // Use our proxy endpoint
            duration: metadata.duration || 0,
            channel: metadata.channel || metadata.uploader || 'Unknown Artist',
            viewCount: metadata.view_count || 0
        });

    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch audio stream',
            details: error.message
        });
    }
});

// Multi-search endpoint - returns multiple results for song list
app.get('/search-list', async (req, res) => {
    const { query, count = 5 } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        console.log(`Searching for ${count} tracks: ${query}`);
        const searchQuery = `ytsearch${count}:${query}`;

        // Get metadata for multiple results
        const metadataJson = await runYtDlp(
            `--dump-single-json --flat-playlist --no-warnings "${searchQuery}"`
        );

        const result = JSON.parse(metadataJson);
        const entries = result.entries || [result];

        const tracks = entries.map(entry => {
            const thumbnail = entry.thumbnails && entry.thumbnails.length > 0
                ? entry.thumbnails[entry.thumbnails.length - 1].url
                : '';

            return {
                id: entry.id,
                title: entry.title || 'Unknown Track',
                thumbnail: thumbnail ? `/thumbnail/${encodeURIComponent(thumbnail)}` : '',
                duration: entry.duration || 0,
                channel: entry.channel || entry.uploader || 'Unknown Artist'
            };
        });

        console.log(`Found ${tracks.length} tracks`);
        res.json({ tracks });

    } catch (error) {
        console.error('Search list error:', error.message);
        res.status(500).json({ error: 'Failed to search', details: error.message });
    }
});

// Get stream for a specific video ID
app.get('/play/:videoId', async (req, res) => {
    const { videoId } = req.params;

    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // Get metadata
        const metadataJson = await runYtDlp(
            `--dump-single-json --no-warnings "${url}"`
        );
        const metadata = JSON.parse(metadataJson);

        // Get audio URL
        const audioUrl = await runYtDlp(`-g -f "bestaudio" --no-warnings "${url}"`);

        // Cache and return proxy URL
        const streamId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        urlCache.set(streamId, {
            url: audioUrl.split('\n')[0],
            expires: Date.now() + 3600000
        });

        const thumbnail = metadata.thumbnail ||
            (metadata.thumbnails && metadata.thumbnails.length > 0
                ? metadata.thumbnails[metadata.thumbnails.length - 1].url
                : '');

        res.json({
            id: metadata.id,
            title: metadata.title || 'Unknown Track',
            thumbnail: thumbnail ? `/thumbnail/${encodeURIComponent(thumbnail)}` : '',
            audioUrl: `/proxy/${streamId}`,
            duration: metadata.duration || 0,
            channel: metadata.channel || metadata.uploader || 'Unknown Artist'
        });
    } catch (error) {
        console.error('Play error:', error.message);
        res.status(500).json({ error: 'Failed to get stream URL' });
    }
});

// Thumbnail proxy - fetch YouTube thumbnails through our server
app.get('/thumbnail/:url', async (req, res) => {
    const thumbnailUrl = decodeURIComponent(req.params.url);

    try {
        const protocol = thumbnailUrl.startsWith('https') ? https : http;

        const proxyReq = protocol.get(thumbnailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (proxyRes) => {
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            proxyRes.pipe(res);
        });

        proxyReq.on('error', () => {
            res.status(404).send('Thumbnail not found');
        });
    } catch (error) {
        res.status(500).send('Failed to fetch thumbnail');
    }
});

// Proxy endpoint - streams audio through our server to bypass CORS
app.get('/proxy/:streamId', async (req, res) => {
    const { streamId } = req.params;

    const cached = urlCache.get(streamId);
    if (!cached) {
        return res.status(404).json({ error: 'Stream not found or expired' });
    }

    const audioUrl = cached.url;
    console.log(`Proxying stream: ${streamId}`);

    try {
        // Set headers for audio streaming
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');

        // Parse the URL to determine protocol
        const protocol = audioUrl.startsWith('https') ? https : http;

        // Forward the request to YouTube's servers
        const proxyReq = protocol.get(audioUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Range': req.headers.range || 'bytes=0-'
            }
        }, (proxyRes) => {
            // Forward status code and relevant headers
            res.status(proxyRes.statusCode);

            if (proxyRes.headers['content-type']) {
                res.setHeader('Content-Type', proxyRes.headers['content-type']);
            }
            if (proxyRes.headers['content-length']) {
                res.setHeader('Content-Length', proxyRes.headers['content-length']);
            }
            if (proxyRes.headers['content-range']) {
                res.setHeader('Content-Range', proxyRes.headers['content-range']);
            }

            // Pipe the response
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (error) => {
            console.error('Proxy error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream failed' });
            }
        });

        // Handle client disconnect
        req.on('close', () => {
            proxyReq.destroy();
        });

    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to proxy stream' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', cookiesEnabled: cookiesExist, cachedStreams: urlCache.size });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🎵 ClashStream Server Running                   ║
║   📍 http://localhost:${PORT}                       ║
║   🚀 Cookie-less Mode                             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});
