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

function run() {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const listOnlyOpenDocs = parseInt($.getenv('LIST_ONLY_OPEN_DOCS'));
  const numRecentDirs = parseInt($.getenv('NUM_RECENT_DIRS'));
  const alfredWorkflowDataPath = $($.getenv('alfred_workflow_data')).stringByStandardizingPath.js
  const dataPath = alfredWorkflowDataPath + '/data.json'
  const getData = (function() {
    let data = undefined;
    return function() {
      if (data === undefined) {
        if ($.NSFileManager.defaultManager.fileExistsAtPath(dataPath) && $.NSFileManager.defaultManager.isReadableFileAtPath) {
          const jsonStr = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(
            $.NSFileManager.defaultManager.contentsAtPath(dataPath),
            $.NSUTF8StringEncoding,
          ));
          data = JSON.parse(jsonStr);
        } else {
          data = null;
        }
      }
      return data;
    };
  })();
  const mruDirList = new MruList(numRecentDirs);
  getData() && mruDirList.setList(getData()['mruDirList']);

  const items = [];
  const addedDocs = new Set();
  const dirs = [];
  const addedDirs = new Set();

  const app = Application("Typora");
  if (!app.running()) {
    items.push({
      title: `Typora is not running`,
      subtitle: `Press enter to launch Typora`,
      variables: {
        isOpen: true,
      },
    });
  } else {
    for (let w = 0; w < app.windows.length; w++) {
      const win = app.windows[w];
      const doc = win.document();

      if (doc !== undefined) {
        const name = doc.name();
        // Untitled documents have no paths.
        const path = doc.path() || name;
        const hasPath = !!doc.path();

        if (!addedDocs.has(path)) {
          items.push({
            title: name,
            subtitle: path,
            quicklookurl: (hasPath ? path : null),
            match: `${name} ${path.replace(
              /[^A-Za-z0-9]/g,
              " ",
            )}`,
            icon: { path: 'icon.png' },
            arg: `${win.id()}`,
            mods: {
              alt: {
                valid: true,
                arg: `${win.id()}`,
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

  for (let i = mruDirList.list.length - 1; i >= 0; i--) {
    const dir = mruDirList.list[i];
    if (!addedDirs.has(dir)) {
      dirs.push(dir);
      addedDirs.add(dir);
    }
  }

  const processedDirs = new Set();
  if (!listOnlyOpenDocs) {
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
          if (!addedDocs.has(path)) {
            items.push({
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
            addedDocs.add(path);
          }
        }
        processedDirs.add(dir);
      }
    }
  }

  // Make the Alfred workflow data directory.
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(
    alfredWorkflowDataPath,
    1,  // Make intermediate directories.
    $(),
    $(),  // error
  );
  
  $.NSString.alloc.initWithUTF8String(JSON.stringify({
    mruDirList: mruDirList.list,
  })).writeToFileAtomicallyEncodingError(dataPath, true, $.NSUTF8StringEncoding, null);

  return JSON.stringify({ items });
}

