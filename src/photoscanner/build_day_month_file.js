const fs = require('fs');
const path = require('path');
const config = require('../config');
const get_month_day_photos = require('../dbmanager/get_month_day_photos');
const { prepareImages } = require('./prepare_image');
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Build the playlist for a given date: find that day's photos, convert each to
// a display-ready JPEG (EXIF-rotated, HEIC-decoded, sized to the panel), and
// write the cache paths that fbi will show.
const buildFile = async (date) => {
    if (!date) {
        throw new Error('No date provided');
    }
    const day = date.getDate();
    const month = date.getMonth();

    const originals = await get_month_day_photos(month, day);
    const displayImages = await prepareImages(originals);
    if (originals.length > 0 && displayImages.length === 0) {
        throw new Error(
            `Found ${originals.length} photos for ${months[month]}/${day} but none could be prepared (is ImageMagick installed?)`
        );
    }

    const fileName = path.join(config.playlistDir, `files_${months[month]}_${day}.txt`);
    await fs.promises.writeFile(fileName, displayImages.map((p) => `${p}\n`).join(''));
    return fileName;
};

module.exports = buildFile;
