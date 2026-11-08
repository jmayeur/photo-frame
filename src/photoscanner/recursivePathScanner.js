const util = require("util");
const exec = util.promisify(require("child_process").exec);

const fs = require('fs');
const path = require('path');
const config = require('../config');

const { minBytes, iphoneMinBytes, maxBytes, iphoneFolderMatch, extensions } = config.scan;
const extRegex = new RegExp(`\\.(${extensions.join('|')})$`, 'i');

const isValidFile = (fullfilepath, fileName, fileSize) => {
    const floor = fullfilepath.toLowerCase().includes(iphoneFolderMatch.toLowerCase())
        ? iphoneMinBytes
        : minBytes;
    return extRegex.test(fileName) && fileSize >= floor && fileSize <= maxBytes;
};

const walk = async (dir) => {
    return new Promise((resolve, reject) => {
        let results = [];

        fs.readdir(dir, (err, list) => {
            if (err) {
                return reject(err);
            };

            let pending = list.length;
            if (!pending) {
                return resolve(results);
            }

            list.forEach((file) => {
                const fullfilepath = path.resolve(dir, file);
                fs.stat(fullfilepath, async (err, stat) => {
                    if (err) {
                        return reject(err);
                    }
                    if (stat && stat.isDirectory()) {
                        walk(fullfilepath).then((res) => {
                            results = results.concat(res);
                            if (!--pending) {
                                resolve(results);
                            }
                        }).catch((err) => {
                            reject(err);
                        });
                    } else {
                        if (isValidFile(fullfilepath, file, stat.size)) {
                            results.push({ path: fullfilepath, date: new Date(stat.mtime) });
                        }
                        if (!--pending) {
                            resolve(results);
                        }
                    }
                });
            });
        });
    });
};

module.exports = walk;