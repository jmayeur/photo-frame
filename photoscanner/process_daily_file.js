const buildDailyFile = require('./build_day_month_file');
const { unlink, copyFile } = require('node:fs/promises');
const fs = require('fs');
const restartPhotoFrame = require('./restart_photo_frame');
const defaultFile = '/home/pi/files.txt';
const backupFile = '/home/pi/backup_files.txt';

const waitForFile = (file) => {
    return new Promise((resolve, reject) => {
        let tries = 0;
        const interval = setInterval(() => {
            if (fs.existsSync(file)) {
                clearInterval(interval);
                return resolve();
            }
            tries++;
            if (tries > 20) {
                clearInterval(interval);
                return reject('File not found');
            }
        }, 100);
    });
}

const processDailyFile = async () => {
    const today = new Date();

    try {
        const fileName = await buildDailyFile(today);
        if (fs.existsSync(defaultFile)) {
            await copyFile(defaultFile, backupFile);
        }

        await waitForFile(fileName);

        await copyFile(fileName, defaultFile);
        console.log('Daily file updated');

        if (fs.existsSync(backupFile)) {
            await unlink(backupFile);
        }

        await restartPhotoFrame();


    } catch (err) {
        return console.error(err);
    }
}

processDailyFile();