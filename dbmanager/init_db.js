const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('photofiles.db');

db.serialize(() => {
    db.run("CREATE TABLE photos (hash UNIQUE PRIMARY KEY, path TEXT, date DATETIME, month INTEGER, year INTEGER, day INTEGER)");
});

db.close();