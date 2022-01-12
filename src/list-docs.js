#!/usr/bin/env osascript -l JavaScript

function run() {
  const app = Application("Typora");
  if (!app.running()) {
    return JSON.stringify({
      items: [
        {
          title: `Typora is not running`,
          subtitle: `Press enter to launch Typora`,
        },
      ],
    });
  }

  const docsMap = {};
  for (let w = 0; w < app.windows.length; w++) {
    const win = app.windows[w];
    const doc = win.document();

    if (doc !== undefined) {
      const name = doc.name();
      // Untitled documents have no paths.
      const path = doc.path() || name;
      const hasPath = !!doc.path();

      docsMap[path] = {
        uid: path,
        title: name,
        subtitle: path,
        quicklookurl: (hasPath ? path : null),
        match: `${name} ${path.replace(
          /[^A-Za-z0-9]/g,
          " ",
        )}`,
        arg: `${win.id()}`,
        mods: {
          alt: {
            valid: true,
            arg: `${win.id()}`,
            subtitle: `Close ${name}${doc.modified() ? " (Edited)" : ""}`,
          }
        }
      };
    }
  }

  const items = Object.keys(docsMap).reduce((acc, path) => {
    acc.push(docsMap[path]);
    return acc;
  }, []);

  return JSON.stringify({ items });
}

