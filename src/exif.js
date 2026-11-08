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
// new files to read. Callers that process in chunks pass log=false and do
// their own progress reporting at the chunk boundary.
const enrichCaptureDates = async (files, concurrency = 16, log = true) => {
    const total = files.length;
    const step = Math.max(1, Math.floor(total / 20)); // log ~every 5%
    let next = 0;
    let done = 0;
    const worker = async () => {
        while (next < total) {
            const file = files[next++];
            file.date = await getCaptureDate(file.path, file.date);
            done++;
            if (log && (done % step === 0 || done === total)) {
                const pct = Math.round((done / total) * 100);
                console.log(`  EXIF ${done}/${total} (${pct}%)`);
            }
        }
    };
    const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
    await Promise.all(workers);
    return files;
};

module.exports = { getCaptureDate, enrichCaptureDates };
