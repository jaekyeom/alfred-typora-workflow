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

const getProjectDir = (function() {
  let projectDirCache = {};
  return function(curr, dir) {
    if (projectDirCache[dir] === undefined) {
      projectDirCache[dir] = curr.doShellScript(`cd '${dir.replace(/'/g, "'\\''")}'; git rev-parse --show-toplevel || pwd`);
    }
    return projectDirCache[dir];
  };
})();

function run() {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const curr = Application.currentApplication();
  curr.includeStandardAdditions = true;
  const workflowVersion = $.getenv('alfred_workflow_version');
  const alfredWorkflowCachePath = $($.getenv('alfred_workflow_cache')).stringByStandardizingPath.js;

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

          if (hasPath) {
            const dir = getProjectDir(
              curr,
              $.NSString.alloc.initWithUTF8String(path).stringByDeletingLastPathComponent.js + '/');
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
    version: workflowVersion,
    openDocsRaw: openDocsRaw,
    projectDirs: dirs,
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

  {
    const processedFiles = new Set();
    const listFiles = function(pattern) {
      const allFiles = [];
      const processedDirs = new Set();
      dirs.forEach(function(dir) {
        if (!processedDirs.has(dir)) {
          const files = curr.doShellScript(`cd '${dir.replace(/'/g, "'\\''")}'; find . \\( -path "./.*" -o -path "./*/.*" \\) -prune -o -type f -name "${pattern}"`).split('\r');
          for (let d = 0; d < files.length; d++) {
            const name = $(files[d]).lastPathComponent.js;
            if (name.startsWith('.')) {
              continue;
            }
            const path = dir + '/' + files[d].replace(/^[.][/]/, '');
            if (!processedFiles.has(path)) {
              allFiles.push({
                name: name,
                path: path,
              });
              processedFiles.add(path);
            }
          }
          processedDirs.add(dir);
        }
      });
      return allFiles;
    };

    writeJSONToFile({
      timestamp: Date.now(),
      version: workflowVersion,
      docsFromDiskRaw: listFiles('*.md'),
      projectDirs: dirs,
    }, alfredWorkflowCachePath + '/docs_from_disk_cache.json');

    writeJSONToFile({
      timestamp: Date.now(),
      version: workflowVersion,
      otherFilesFromDiskRaw: listFiles('*'),
      projectDirs: dirs,
    }, alfredWorkflowCachePath + '/other_files_from_disk_cache.json');
  }

  for (let i = dirs.length - 1; i >= 0; i--) {
    mruDirList.add(dirs[i]);
  }

  writeJSONToFile({
    timestamp: Date.now(),
    version: workflowVersion,
    mruDirList: mruDirList.list,
  }, dataPath);
}

