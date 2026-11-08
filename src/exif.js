const exifr = require('exifr');

// Returns the Date a photo was actually taken, preferring EXIF
// DateTimeOriginal (then CreateDate, then ModifyDate), and falling back to the
// provided value (the file's mtime) when there is no readable EXIF — e.g. PNG,
// GIF, or stripped/corrupt metadata.
const getCaptureDate = async (filePath, fallback) => {
    try {
        const exif = await exifr.parse(filePath, {
            pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
        });
        const taken = exif && (exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate);
        if (taken instanceof Date && !isNaN(taken.getTime())) {
            return taken;
        }
    } catch {
        // Unreadable / absent EXIF — fall through to the fallback.
    }
    return fallback;
};

// Enrich each file's `date` in place with its EXIF capture date. Bounded
// concurrency keeps a Pi 3 responsive when the first scan has thousands of
// new files to read.
const enrichCaptureDates = async (files, concurrency = 16) => {
    let i = 0;
    const worker = async () => {
        while (i < files.length) {
            const file = files[i++];
            file.date = await getCaptureDate(file.path, file.date);
        }
    };
    const workers = Array.from(
        { length: Math.min(concurrency, files.length) },
        worker
    );
    await Promise.all(workers);
    return files;
};

module.exports = { getCaptureDate, enrichCaptureDates };
