const util = require("util");
const exec = util.promisify(require("child_process").exec);

const fs = require('fs');
const path = require('path');

const filesSizeFloor = 200 * 1024;
const filesSizeiPhoneFloor = 1000 * 1024;
const filesSizeCeil = 10 * 1024 * 1024;

const isValidFile = (fullfilepath, fileName, fileSize) => {
    if (fullfilepath.toLowerCase().includes('jeff iphone photos')) {
        return fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|heic)$/i) && fileSize >= filesSizeiPhoneFloor && fileSize <= filesSizeCeil;
    }
    return fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|heic)$/i) && fileSize >= filesSizeFloor && fileSize <= filesSizeCeil;
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