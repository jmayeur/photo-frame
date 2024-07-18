const sqlite3 = require('sqlite3').verbose();
const getHash = require('./get_hash');
const processInserts = require('./process_inserts');

const filterExistingFiles = async (db, files) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT hash FROM photos;', (err, rows) => {
            if (err) {
                reject(err);
            }
            if (!rows || rows.length < 1) {
                resolve(files);
            } else {
                const dbHashes = rows.map(row => row.hash);
                resolve(files.filter(file => {
                    return !dbHashes.some(dbHash => dbHash === file.hash);
                }));
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
    console.log(`Found ${potentialInserts.length} new photos`);
    const filteredFiles = await filterExistingFiles(db, potentialInserts);
    console.log(`Inserting ${filteredFiles.length} new  photos`);
    if (filteredFiles.length < 1) {
        return Promise.resolve();
    }
    return await processInserts(db, filteredFiles);
}

module.exports = async (files) => {
    const db = new sqlite3.Database('/home/pi/filescanner/dbmanager/photofiles.db');
    return await processRawFiles(db, files) && db.close();
};

