const sqlite3 = require('sqlite3').verbose();
const config = require('../config');
const getHash = require('./get_hash');
const processInserts = require('./process_inserts');
const { enrichCaptureDates } = require('../exif');

const filterExistingFiles = async (db, files) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT hash FROM photos;', (err, rows) => {
            if (err) {
                return reject(err);
            }
            if (!rows || rows.length < 1) {
                resolve(files);
            } else {
                // Set lookup is O(1); the previous Array.some made the filter
                // O(n*m) — ~58k x 58k on a full library scan.
                const dbHashes = new Set(rows.map(row => row.hash));
                resolve(files.filter(file => !dbHashes.has(file.hash)));
            }
        });
    });
}


// Build insert rows, deduped by hash. Configured photoFolders can overlap (one
// nested under another, or reachable two ways), so the recursive walker can
// emit the same path more than once; without this, the duplicate rows collide
// on the UNIQUE(hash) index and also waste an EXIF read each.
const generatePotentialInserts = (files) => {
    const seen = new Set();
    const inserts = [];
    for (const file of files) {
        const hash = getHash(file.path);
        if (seen.has(hash)) {
            continue;
        }
        seen.add(hash);
        inserts.push({ hash, path: file.path, date: file.date });
    }
    return inserts;
};

// Enrich + insert this many files at a time. A full first scan has tens of
// thousands of new photos; reading EXIF for all of them in one pass lets
// exifr's per-file buffers accumulate until Node's ~450MB old-space on a 1GB
// Pi 3 OOMs near the end. Chunking keeps peak memory flat (GC reclaims between
// chunks) and commits each chunk, so an interrupted scan resumes where it left
// off — already-indexed hashes are skipped by filterExistingFiles next run.
const CHUNK_SIZE = 2000;

const processRawFiles = async (db, files) => {
    const potentialInserts = generatePotentialInserts(files);
    const dupCount = files.length - potentialInserts.length;
    console.log(`Scanned ${files.length} photos on disk${dupCount ? ` (${dupCount} duplicate paths skipped)` : ''}`);
    const filteredFiles = await filterExistingFiles(db, potentialInserts);
    console.log(`${filteredFiles.length} new photos to index`);
    if (filteredFiles.length < 1) {
        return;
    }
    // Replace mtime with the real EXIF capture date before indexing, so the
    // month/day/year columns reflect when the photo was taken. This reads each
    // new file over the network, so it's the slow step on a first full scan.
    const total = filteredFiles.length;
    console.log(`Reading EXIF + inserting ${total} new photos in chunks of ${CHUNK_SIZE}...`);
    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = filteredFiles.slice(i, i + CHUNK_SIZE);
        await enrichCaptureDates(chunk, 16, false);
        await processInserts(db, chunk);
        const done = Math.min(i + CHUNK_SIZE, total);
        const pct = Math.round((done / total) * 100);
        console.log(`  committed ${done}/${total} (${pct}%)`);
    }
}

module.exports = async (files) => {
    const db = new sqlite3.Database(config.dbPath);
    try {
        await processRawFiles(db, files);
    } finally {
        db.close();
    }
};

