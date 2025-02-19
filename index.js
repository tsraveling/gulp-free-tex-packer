let through = require("through2");
let path = require("path");
let PluginError = require("plugin-error")
let texturePacker = require("@tsraveling/free-tex-packer-core");
let appInfo = require("./package.json");

function fixPath(path) {
  return path.split("\\").join("/");
}

function getExtFromPath(path) {
  return path.split(".").pop().toLowerCase();
}

function getError(txt) {
  return new PluginError(appInfo.name, txt)
}

const SUPPORTED_EXT = ["png", "jpg", "jpeg"];

module.exports = function(options) {
  let files = [];
  let firstFile = null;

  function bufferContents(file, _enc, cb) {
    if (file.isNull()) {
      cb();
      return;
    }

    if (file.isStream()) {
      cb(getError("Streaming not supported"));
      return;
    }

    if (!firstFile) firstFile = file;

    if (SUPPORTED_EXT.indexOf(getExtFromPath(file.relative)) < 0) {
      cb();
      return;
    }

    files.push({
      path: fixPath(file.base + '/' + file.relative),
      relative: file.relative,
      contents: file.contents
    });

    cb();
  }

  function endStream(cb) {
    if (!files.length) {
      cb();
      return;
    }

    if (!options) options = {};
    options.appInfo = appInfo;

    let folderStructure = {}

    files.forEach(file => {
      let parts = file.relative.split("/")
      let filename = parts.pop()
      let folder = parts.join('/')
      if (!folderStructure[folder]) {
        folderStructure[folder] = []
      }
      file.relative = filename
      folderStructure[folder].push(file)
    })

    let exportsLeft = Object.keys(folderStructure).length

    // STUB: Set it up so that each folder outputs to its own spritesheet

    Object.keys(folderStructure).forEach(path => {
      console.log(">>> processing", path)
      const folderFiles = folderStructure[path]
      texturePacker(folderFiles, options, (files, error) => {
        if (error) {
          cb(getError(error.message || error.description || "Unknown error"));
          return;
        }
        for (let item of files) {
          let file = firstFile.clone({ contents: false });
          file.path = path.join(firstFile.base, item.name);
          file.contents = item.buffer;
          this.push(file);
        }
        exportsLeft -= 1;
        if (exportsLeft <= 0) {
          cb();
        }
      });
    })

  }

  return through.obj(bufferContents, endStream);
};
