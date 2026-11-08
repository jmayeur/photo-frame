const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

// month is 0-11 (matches Date.getMonth() and the stored `month` column).
const queryDay = (db, month, day) =>
    new Promise((resolve, reject) => {
        db.all(
            'SELECT path FROM photos WHERE month = ? AND day = ?',
            [month, day],
            (err, rows) => {
                if (err) {
                    return reject(err);
                }
                resolve((rows || []).map((row) => row.path));
            }
        );
    });

// Return the photos taken on the given month/day (across all years). If that
// day has none, walk forward one calendar day at a time so the frame is never
// blank. Using a real Date handles month lengths and the year wrap correctly
// and guarantees termination (previously this could recurse past December into
// an invalid month forever).
const getPhotoPaths = async (month, day) => {
    const db = new sqlite3.Database(config.dbPath);
    try {
        const cursor = new Date(2000, month, day); // leap year: Feb 29 is valid
        for (let i = 0; i < 366; i++) {
            const paths = await queryDay(db, cursor.getMonth(), cursor.getDate());
            if (paths.length > 0) {
                return paths;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return [];
    } finally {
        db.close();
    }
};

module.exports = getPhotoPaths;
