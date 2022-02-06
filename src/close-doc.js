#!/usr/bin/env osascript -l JavaScript

function run(args) {
  const app = Application("Typora");
  const wasRunning = app.running();
  let found = false;
  let name = undefined;
  if (wasRunning) {
    const argSplitted = args[0].split(/,(.*)/);
    const windowId = parseInt(argSplitted[0]);
    const path = argSplitted[1];
    for (let w = 0; w < app.windows.length; w++) {
      const win = app.windows[w];
      if (win.id() == windowId && path == (win.document().path() || win.document().name())) {
        found = true;
        if (!!win.document() && !win.document().path() && win.document().modified()) {
          // Closing the document will open the save prompt.
          name = win.document().name();
          win.index = 1;
        } else {
          win.close();
        }
        break;
      }
    }
    if (!found) {
      for (let w = 0; w < app.windows.length; w++) {
        const win = app.windows[w];
        if (path == (win.document().path() || win.document().name())) {
          found = true;
          if (!!win.document() && !win.document().path() && win.document().modified()) {
            // Closing the document will open the save prompt.
            name = win.document().name();
            win.index = 1;
          } else {
            win.close();
          }
          break;
        }
      }
    }

    if (name !== undefined) {
      app.activate();
      // TODO: A reliable way to activate the corresponding window.
      const sys = Application("System Events");
      const windows = sys.processes["Typora"].windows;
      for (let w = 0; w < windows.length; w++) {
        if (windows[w].name() == name) {
          windows[w].actions['AXRaise'].perform();
          break;
        }
      }

      for (let w = 0; w < app.windows.length; w++) {
        const win = app.windows[w];
        if (win.id() == windowId) {
          win.close();
          break;
        }
      }
    }
  }
  return JSON.stringify({
    alfredworkflow: {
      arg: (name !== undefined) ? 'noAction' : 'reopenSearch',
    },
  })
}

