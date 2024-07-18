const fs = require('fs');
const get_month_day_photos = require('../dbmanager/get_month_day_photos');
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const buildFile = async (date) => {

    return new Promise(async (resolve, reject) => {
        if (!date) {
            reject('No date provided');
        }
        const day = date.getDate();
        const month = date.getMonth();

        const photos = await get_month_day_photos(month, day);
        const textMonth = months[month];
        const fileName = `/home/pi/files_${textMonth}_${day}.txt`;
        const file = fs.createWriteStream(fileName);
        photos.forEach(photo => {
            file.write(`${photo}\n`);
        });
        file.end();
        file.close();
        resolve(fileName);
    });
};

module.exports = buildFile;