const fs = require('fs');
const path = require('path');
const config = require('../config');
const get_month_day_photos = require('../dbmanager/get_month_day_photos');
const { prepareImages, pruneCache } = require('./prepare_image');
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Build the playlist for a given date: find that day's photos, convert each to
// a display-ready JPEG (EXIF-rotated, HEIC-decoded, sized to the panel), write
// the cache paths that fbi will show, record a cache->original manifest (for
// `npm run whereis`), and prune last run's now-unused cache images.
const buildFile = async (date) => {
    if (!date) {
        throw new Error('No date provided');
    }
    const day = date.getDate();
    const month = date.getMonth();

    const originals = await get_month_day_photos(month, day);
    const prepared = await prepareImages(originals); // [{ src, out }]
    if (originals.length > 0 && prepared.length === 0) {
        throw new Error(
            `Found ${originals.length} photos for ${months[month]}/${day} but none could be prepared (is ImageMagick installed?)`
        );
    }

    const fileName = path.join(config.playlistDir, `files_${months[month]}_${day}.txt`);
    await fs.promises.writeFile(fileName, prepared.map((p) => `${p.out}\n`).join(''));

    // Manifest maps the on-screen cache filename back to the original NAS path.
    fs.mkdirSync(config.cacheDir, { recursive: true });
    const manifest = path.join(config.cacheDir, 'manifest.tsv');
    await fs.promises.writeFile(
        manifest,
        prepared.map((p) => `${path.basename(p.out)}\t${p.src}\n`).join('')
    );

    const removed = pruneCache(prepared.map((p) => path.basename(p.out)));
    if (removed) {
        console.log(`Pruned ${removed} stale cache image(s)`);
    }
    return fileName;
};

module.exports = buildFile;
