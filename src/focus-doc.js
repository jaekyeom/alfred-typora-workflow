#!/usr/bin/env osascript -l JavaScript

function run(args) {
  const app = Application("Typora");
  const wasRunning = app.running();
  app.activate();
  let name = undefined;
  const argSplitted = args[0].split(/,(.*)/);
  const windowId = parseInt(argSplitted[0]);
  const path = argSplitted[1];
  if (wasRunning) {
    for (let w = 0; w < app.windows.length; w++) {
      const win = app.windows[w];
      if (!win.document()) {
        continue;
      }
      if (win.id() == windowId && path == (win.document().path() || win.document().name())) {
        name = win.document().name();
        win.index = 1;
        break;
      }
    }
    if (name === undefined) {
      for (let w = 0; w < app.windows.length; w++) {
        const win = app.windows[w];
        if (!win.document()) {
          continue;
        }
        if (path == (win.document().path() || win.document().name())) {
          name = win.document().name();
          win.index = 1;
          break;
        }
      }
    }

    if (name !== undefined) {
      // TODO: A reliable way to activate the corresponding window.
      const sys = Application("System Events");
      const windows = sys.processes["Typora"].windows;
      for (let w = 0; w < windows.length; w++) {
        if (windows[w].name() == name) {
          windows[w].actions['AXRaise'].perform();
          break;
        }
      }
    }
  }
  if (name === undefined) {
    const curr = Application.currentApplication();
    curr.includeStandardAdditions = true;
    curr.doShellScript(`open -a Typora '${path.replace(/'/g, "'\\''")}'`);
  }
}

