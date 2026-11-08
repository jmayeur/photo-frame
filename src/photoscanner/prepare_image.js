const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const { width, height } = config.panel;
const bin = (config.imagemagick && config.imagemagick.bin) || 'convert';
const quality = String((config.imagemagick && config.imagemagick.quality) || 90);

// Deterministic cache filename from source path + mtime: a re-export of the
// same file reuses the cache, an edited file re-converts.
const cacheName = (src, mtimeMs) => {
    const h = crypto.createHash('sha1').update(`${src}:${mtimeMs}`).digest('hex');
    return `${h.slice(0, 16)}.jpg`;
};

// Produce a display-ready JPEG for `src`, sized exactly to the panel:
// EXIF-rotated, scaled to fit, letterboxed on black, alpha flattened, metadata
// stripped. Reads HEIC via ImageMagick's HEIF delegate. Returns the cache path,
// or null if the source is missing or conversion fails.
const prepareImage = async (src) => {
    let stat;
    try {
        stat = fs.statSync(src);
    } catch {
        return null; // source vanished (e.g. moved on the NAS since indexing)
    }

    const out = path.join(config.cacheDir, cacheName(src, stat.mtimeMs));
    if (fs.existsSync(out)) {
        return out;
    }

    fs.mkdirSync(config.cacheDir, { recursive: true });
    const args = [
        `${src}[0]`, // first frame/page only (animated GIF, multi-image HEIC)
        '-auto-orient',
        '-resize', `${width}x${height}`,
        '-background', 'black',
        '-gravity', 'center',
        '-extent', `${width}x${height}`,
        '-strip',
        '-quality', quality,
        out,
    ];

    try {
        await execFile(bin, args, { timeout: 60000 });
        return out;
    } catch (err) {
        console.error(`convert failed for ${src}: ${err.message}`);
        return null;
    }
};

// Convert many sources with bounded concurrency (Pi 3 has 4 cores). Preserves
// order and drops any that failed.
const prepareImages = async (sources, concurrency = 4) => {
    const results = new Array(sources.length);
    let i = 0;
    const worker = async () => {
        while (i < sources.length) {
            const idx = i++;
            results[idx] = await prepareImage(sources[idx]);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(concurrency, sources.length) }, worker)
    );
    return results.filter(Boolean);
};

module.exports = { prepareImage, prepareImages };
