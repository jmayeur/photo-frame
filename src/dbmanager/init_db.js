const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new sqlite3.Database(config.dbPath);

db.serialize(() => {
    db.run("CREATE TABLE photos (hash UNIQUE PRIMARY KEY, path TEXT, date DATETIME, month INTEGER, year INTEGER, day INTEGER)");
});

db.close();
