const sqlite3 = require('sqlite3').verbose();

module.exports = async (month, day) => {
    const db = new sqlite3.Database('/home/pi/filescanner/dbmanager/photofiles.db');
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM photos WHERE day=${day} AND month=${month};`, (err, rows) => {
            if (err) {
                reject(err);
            }
            if (!rows || rows.length < 1) {
                resolve([]);
            } else {
                resolve(rows.map(row => row.path));
            }
            db.close();
        });
    });
};