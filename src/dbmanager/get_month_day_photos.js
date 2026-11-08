const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

const getPhotoPaths = async (month, day) => {
    const db = new sqlite3.Database(config.dbPath);
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM photos WHERE day=${day} AND month=${month};`, async (err, rows) => {
            if (err) {
                reject(err);
            }
            if (!rows || rows.length < 1) {
                if (day > 31) {
                    resolve(await getPhotoPaths(month + 1, 1));
                } else {
                    resolve(await getPhotoPaths(month, day + 1));
                }
            } else {
                resolve(rows.map(row => row.path));
            }
            db.close();
        });
    });
};

module.exports = getPhotoPaths;