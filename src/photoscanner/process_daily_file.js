const buildDailyFile = require("./build_day_month_file");
const { unlink, copyFile } = require("node:fs/promises");
const fs = require("fs");
const restartPhotoFrame = require("./restart_photo_frame");
const config = require("../config");
const path = require("path");
const defaultFile = config.playlist;
const backupFile = config.backupPlaylist;
const DAY_MS = 24 * 60 * 60 * 1000;
const retentionDays = config.playlistRetentionDays ?? 10;

// Delete daily files_<mon>_<day>.txt playlists older than retentionDays (by
// mtime). files.txt itself, the backup and anything else are never touched.
const pruneOldPlaylists = () => {
  const cutoff = Date.now() - retentionDays * DAY_MS;
  let removed = 0;
  for (const name of fs.readdirSync(config.playlistDir)) {
    if (!/^files_[a-z]{3}_\d{1,2}\.txt$/.test(name)) continue;
    const file = path.join(config.playlistDir, name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) {
        fs.unlinkSync(file);
        removed++;
      }
    } catch (err) {
      console.error(`Could not prune ${file}: ${err.message}`);
    }
  }
  if (removed) console.log(`Pruned ${removed} daily playlist(s) older than ${retentionDays} days`);
};

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
        return reject("File not found");
      }
    }, 100);
  });
};

const processDailyFile = async () => {
  let today = new Date();

  try {
    if (process.argv.length > 2) {
      today = new Date(process.argv[2]);
      if (isNaN(today)) {
        today = new Date();
      }
    }
  } catch {
    today = new Date();
  }

  try {
    const fileName = await buildDailyFile(today);
    if (fs.existsSync(defaultFile)) {
      await copyFile(defaultFile, backupFile);
    }

    await waitForFile(fileName);

    await copyFile(fileName, defaultFile);
    console.log("Daily file updated");

    if (fs.existsSync(backupFile)) {
      await unlink(backupFile);
    }

    pruneOldPlaylists();

    await restartPhotoFrame();
  } catch (err) {
    return console.error(err);
  }
};

processDailyFile();
