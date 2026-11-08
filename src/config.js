// Central configuration loader.
//
// Resolves, in order:
//   1. $PHOTO_FRAME_CONFIG (explicit path)
//   2. <repo>/config.json   (per-host, git-ignored)
//   3. <repo>/config.example.json  (committed defaults)
//
// Every path that used to be hard-coded to /home/pi now comes from here,
// so a reimage onto a different user/host only needs config.json edited.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const userCfg = process.env.PHOTO_FRAME_CONFIG || path.join(ROOT, "config.json");
const exampleCfg = path.join(ROOT, "config.example.json");

const source = fs.existsSync(userCfg) ? userCfg : exampleCfg;
const raw = JSON.parse(fs.readFileSync(source, "utf8"));

// Absolute photo-source folders (entries may be absolute or relative to photosDir).
const photoFolders = (raw.photoFolders || []).map((f) =>
  path.isAbsolute(f) ? f : path.join(raw.photosDir, f)
);

// The daily "files_<mon>_<day>.txt" files and backup live beside the playlist.
const playlistDir = path.dirname(raw.playlist);

module.exports = {
  ...raw,
  source,
  photoFolders,
  playlistDir,
  backupPlaylist: path.join(playlistDir, "backup_files.txt"),
};
