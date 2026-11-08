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
// same file reuses the cache, an edited file re-converts. The original
// basename is kept as a prefix so fbi's on-screen overlay (-v) is recognizable
// (e.g. "2010-08-11_11.57.12__a1b2c3d4e5f6.jpg"); the 12-hex suffix keeps it
// unique across folders that reuse a basename. Use `npm run whereis` for the
// exact NAS path.
const cacheName = (src, mtimeMs) => {
    const h = crypto.createHash('sha1').update(`${src}:${mtimeMs}`).digest('hex').slice(0, 12);
    const base = path.basename(src, path.extname(src))
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 80);
    return `${base}__${h}.jpg`;
};

// Produce a display-ready JPEG for `src`, sized exactly to the panel:
// EXIF-rotated, scaled to fit, letterboxed on black, alpha flattened, metadata
// stripped. Reads HEIC via ImageMagick's HEIF delegate. Returns { src, out }
// (original path + cache path), or null if the source is missing or conversion
// fails.
const prepareImage = async (src) => {
    let stat;
    try {
        stat = fs.statSync(src);
    } catch {
        return null; // source vanished (e.g. moved on the NAS since indexing)
    }

    const out = path.join(config.cacheDir, cacheName(src, stat.mtimeMs));
    if (fs.existsSync(out)) {
        return { src, out };
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
        return { src, out };
    } catch (err) {
        console.error(`convert failed for ${src}: ${err.message}`);
        return null;
    }
};

// Convert many sources with bounded concurrency (Pi 3 has 4 cores). Preserves
// order and drops any that failed. Returns [{ src, out }].
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

// Delete cached JPEGs not referenced by the current playlist. Consecutive days
// share no photos, so without this the cache grows toward a processed copy of
// the whole library. Only our *.jpg outputs are touched (manifest.tsv is left).
const pruneCache = (keepBasenames) => {
    let entries;
    try {
        entries = fs.readdirSync(config.cacheDir);
    } catch {
        return 0; // cache dir doesn't exist yet — nothing to prune
    }
    const keep = new Set(keepBasenames);
    let removed = 0;
    for (const name of entries) {
        if (!name.endsWith('.jpg') || keep.has(name)) {
            continue;
        }
        try {
            fs.unlinkSync(path.join(config.cacheDir, name));
            removed++;
        } catch {
            // best-effort; a file we can't remove shouldn't fail the build
        }
    }
    return removed;
};

module.exports = { prepareImage, prepareImages, pruneCache };
