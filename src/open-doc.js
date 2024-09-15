#!/usr/bin/env osascript -l JavaScript

function run(args) {
  const arg = JSON.parse(args[0]);
  const curr = Application.currentApplication();
  curr.includeStandardAdditions = true;
  if (arg.path.endsWith('.md')) {
    curr.doShellScript(`open -a Typora '${arg.projectDir.replace(/'/g, "\\'")}' '${arg.path.replace(/'/g, "\\'")}'`);
  } else {
    curr.doShellScript(`open '${arg.path.replace(/'/g, "\\'")}'`);
  }
}

