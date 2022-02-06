#!/usr/bin/env osascript -l JavaScript

class MruList {
  constructor(size) {
    this.size = size;
    this.list = [];
  }

  setList(list) {
    this.list = list;
    this.list.splice(0, this.list.length - this.size);
  }

  add(item) {
    const idx = this.list.indexOf(item);
    if (idx == -1) {
      this.list.push(item);
    } else {
      this.list.push(this.list.splice(idx, 1)[0]);
    }
    this.list.splice(0, this.list.length - this.size);
  }
}

const readJSONFile = (function() {
  let dataCache = {};
  return function(path) {
    if (dataCache[path] === undefined) {
      if ($.NSFileManager.defaultManager.fileExistsAtPath(path) && $.NSFileManager.defaultManager.isReadableFileAtPath) {
        const jsonStr = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(
          $.NSFileManager.defaultManager.contentsAtPath(path),
          $.NSUTF8StringEncoding,
        ));
        dataCache[path] = JSON.parse(jsonStr);
      } else {
        dataCache[path] = null;
      }
    }
    return dataCache[path];
  };
})();

const writeJSONToFile = function(data, path) {
  const dir = $.NSString.alloc.initWithUTF8String(path).stringByDeletingLastPathComponent.js;
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(
    dir,
    1,  // Make intermediate directories.
    $(),
    $(),  // error
  );

  $.NSString.alloc.initWithUTF8String(JSON.stringify(
    data)).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
};

function run() {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const alfredWorkflowCachePath = $($.getenv('alfred_workflow_cache')).stringByStandardizingPath.js;

  const listOnlyOpenDocs = parseInt($.getenv('LIST_ONLY_OPEN_DOCS'));

  const openDocs = [];
  const dirs = [];
  const addedDirs = new Set();

  const app = Application("Typora");
  if (app.running()) {
    const addedDocs = new Set();
    for (let w = 0; w < app.windows.length; w++) {
      const win = app.windows[w];
      const doc = win.document();

      if (doc !== undefined) {
        const name = doc.name();
        // Untitled documents have no paths.
        const path = doc.path() || name;
        const hasPath = !!doc.path();

        if (!addedDocs.has(path)) {
          openDocs.push({
            title: name,
            subtitle: path,
            quicklookurl: (hasPath ? path : null),
            match: `${name} ${path.replace(
              /[^A-Za-z0-9]/g,
              " ",
            )}`,
            icon: { path: doc.modified() ? 'icon_accented.png' : 'icon.png' },
            arg: `${win.id()},${path}`,
            mods: {
              alt: {
                valid: true,
                arg: `${win.id()},${path}`,
                subtitle: `Close ${name}${doc.modified() ? " (Edited)" : ""}`,
              },
              cmd: {
                valid: hasPath,
                arg: path,
                subtitle: (hasPath ? 'Reveal file in Finder' : ''),
              },
            },
            variables: {
              isOpen: true,
            },
          });
          addedDocs.add(path);

          if (!listOnlyOpenDocs && hasPath) {
            const dir = $.NSString.alloc.initWithUTF8String(path).stringByDeletingLastPathComponent.js + '/';
            if (!addedDirs.has(dir)) {
              dirs.push(dir);
              addedDirs.add(dir);
            }
          }
        }
      }
    }
  }

  writeJSONToFile({
    timestamp: Date.now(),
    openDocs: openDocs,
  }, alfredWorkflowCachePath + '/open_docs_cache.json');

  const numRecentDirs = parseInt($.getenv('NUM_RECENT_DIRS'));
  const alfredWorkflowDataPath = $($.getenv('alfred_workflow_data')).stringByStandardizingPath.js;
  const dataPath = alfredWorkflowDataPath + '/data.json';
  const mruDirList = new MruList(numRecentDirs);
  readJSONFile(dataPath) && mruDirList.setList(readJSONFile(dataPath)['mruDirList']);

  for (let i = mruDirList.list.length - 1; i >= 0; i--) {
    const dir = mruDirList.list[i];
    if (!addedDirs.has(dir)) {
      dirs.push(dir);
      addedDirs.add(dir);
    }
  }

  if (!listOnlyOpenDocs) {
    const docsFromDisk = [];
    const processedDirs = new Set();
    const curr = Application.currentApplication();
    curr.includeStandardAdditions = true;
    for (let i = dirs.length - 1; i >= 0; i--) {
      const dir = curr.doShellScript(`cd '${dirs[i].replace(/'/g, "'\\''")}'; git rev-parse --show-toplevel || pwd`);
      mruDirList.add(dir);
      if (!processedDirs.has(dir)) {
        const mdFiles = curr.doShellScript(`cd '${dirs[i].replace(/'/g, "'\\''")}'; gd="$(git rev-parse --show-toplevel)" && git ls-files --full-name --cached --others "$gd/*.md" || ls *.md`).split('\r');
        for (let d = 0; d < mdFiles.length; d++) {
          const name = mdFiles[d].split('/').pop();
          const path = dir + '/' + mdFiles[d];
          docsFromDisk.push({
            title: name,
            subtitle: path,
            quicklookurl: path,
            match: `${name} ${path.replace(
              /[^A-Za-z0-9]/g,
              " ",
            )}`,
            icon: { path: 'icon_dimmed.png' },
            arg: path,
            mods: {
              cmd: {
                valid: true,
                arg: path,
                subtitle: `Reveal file in Finder`,
              },
            },
            variables: {
              isOpen: false,
            },
          });
        }
        processedDirs.add(dir);
      }
    }

    writeJSONToFile({
      timestamp: Date.now(),
      docsFromDisk: docsFromDisk,
    }, alfredWorkflowCachePath + '/docs_from_disk_cache.json');
  }

  writeJSONToFile({
    mruDirList: mruDirList.list,
  }, dataPath);
}

