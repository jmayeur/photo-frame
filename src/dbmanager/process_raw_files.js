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


const generatePotentialInserts = (files) => {
    return files.map(file => {
        return {
            hash: getHash(file.path),
            path: file.path,
            date: file.date
        };
    });
};

const processRawFiles = async (db, files) => {
    const potentialInserts = generatePotentialInserts(files);
    console.log(`Scanned ${potentialInserts.length} photos on disk`);
    const filteredFiles = await filterExistingFiles(db, potentialInserts);
    console.log(`${filteredFiles.length} new photos to index`);
    if (filteredFiles.length < 1) {
        return;
    }
    // Replace mtime with the real EXIF capture date before indexing, so the
    // month/day/year columns reflect when the photo was taken. This reads each
    // new file over the network, so it's the slow step on a first full scan.
    console.log(`Reading EXIF capture dates for ${filteredFiles.length} new photos...`);
    await enrichCaptureDates(filteredFiles);
    console.log(`Inserting ${filteredFiles.length} photos into the database...`);
    await processInserts(db, filteredFiles);
}

module.exports = async (files) => {
    const db = new sqlite3.Database(config.dbPath);
    try {
        await processRawFiles(db, files);
    } finally {
        db.close();
    }
};

