const processInserts = async (db, inserts) => {


    const baseInsertQuery = 'INSERT INTO photos (hash, path, date, month, year, day) VALUES ';

    return new Promise((resolve, reject) => {
        const chunkSize = 10;
        const doneCount = inserts.length;
        if (doneCount < 1) {
            return resolve();
        }
        let processed = 0;
        for (let i = 0; i < inserts.length; i += chunkSize) {
            const chunk = inserts.slice(i, i + chunkSize);
            const placeHolders = new Array(chunk.length).fill('(?, ?, ?, ?, ?, ?)').join(', ');
            const insertQuery = baseInsertQuery + placeHolders;
            db.run(insertQuery, chunk.reduce((acc, val) => {
                return acc.concat([val.hash, val.path, val.date, val.date.getMonth(), val.date.getFullYear(), val.date.getDate()]);
            }, []), (err) => {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                processed += chunk.length;
                if (processed === doneCount) {
                    resolve();
                }
            });
        }
    });
};

module.exports = processInserts;