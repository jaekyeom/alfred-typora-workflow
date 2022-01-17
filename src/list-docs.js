#!/usr/bin/env osascript -l JavaScript

function run() {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const app = Application("Typora");
  if (!app.running()) {
    return JSON.stringify({
      items: [
        {
          title: `Typora is not running`,
          subtitle: `Press enter to launch Typora`,
          variables: {
            isOpen: true,
          },
        },
      ],
    });
  }

  const listOnlyOpenDocs = parseInt($.getenv('LIST_ONLY_OPEN_DOCS'));

  const items = [];
  const addedDocs = new Set();
  const dirs = [];
  const addedDirs = new Set();
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

  const processedDirs = new Set();
  if (!listOnlyOpenDocs) {
    var curr = Application.currentApplication();
    curr.includeStandardAdditions = true;
    for (let i = 0; i < dirs.length; i++) {
      const dir = curr.doShellScript(`cd '${dirs[i].replace(/'/g, "'\\''")}'; git rev-parse --show-toplevel || pwd`);
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

  return JSON.stringify({ items });
}

