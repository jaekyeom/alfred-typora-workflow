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

  const openDocsRaw = [];
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
          openDocsRaw.push({
            windowId: win.id(),
            name: doc.name(),
            path: doc.path(),
            modified: doc.modified(),
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
    version: 2,
    openDocsRaw: openDocsRaw,
  }, alfredWorkflowCachePath + '/open_docs_cache.json');

  const filePattern = parseInt($.getenv('LIST_ONLY_MARKDOWN_FILES')) ? '*.md' : '*';
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
    const markdownDocsFromDiskRaw = [];
    const otherFilesFromDiskRaw = [];
    const processedDirs = new Set();
    const curr = Application.currentApplication();
    curr.includeStandardAdditions = true;
    for (let i = dirs.length - 1; i >= 0; i--) {
      const dir = curr.doShellScript(`cd '${dirs[i].replace(/'/g, "'\\''")}'; git rev-parse --show-toplevel || pwd`);
      mruDirList.add(dir);
      if (!processedDirs.has(dir)) {
        const mdFiles = curr.doShellScript(`cd '${dirs[i].replace(/'/g, "'\\''")}'; gd="$(git rev-parse --show-toplevel)" && git ls-files --full-name --cached --others "$gd/${filePattern}" || find . -name "${filePattern}" -maxdepth 1 -type f -exec basename {} ';'`).split('\r');
        for (let d = 0; d < mdFiles.length; d++) {
          const name = $(mdFiles[d]).lastPathComponent.js;
          const path = dir + '/' + mdFiles[d];
          (name.endsWith('.md') ? markdownDocsFromDiskRaw : otherFilesFromDiskRaw).push({
            name: name,
            path: path,
          });
        }
        processedDirs.add(dir);
      }
    }

    writeJSONToFile({
      timestamp: Date.now(),
      version: 2,
      markdownDocsFromDiskRaw: markdownDocsFromDiskRaw,
      otherFilesFromDiskRaw: otherFilesFromDiskRaw,
    }, alfredWorkflowCachePath + '/docs_from_disk_cache.json');
  }

  writeJSONToFile({
    mruDirList: mruDirList.list,
  }, dataPath);
}

