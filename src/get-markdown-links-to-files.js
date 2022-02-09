#!/usr/bin/env osascript -l JavaScript

const getPathComponents = function(path) {
  if (!path) {
    return path;
  }
  path = $(path);
  const components = [];
  while (path.js != '/') {
    components.unshift(path.lastPathComponent.js);
    path = path.stringByDeletingLastPathComponent;
  }
  return components;
};

const getActiveTyporaDocPath = function() {
  let activeDocPath = null;
  const app = Application("Typora");
  if (app.running()) {
    for (let w = 0; w < app.windows.length; w++) {
      const win = app.windows[w];
      const doc = win.document();
      if (doc !== undefined) {
        activeDocPath = doc.path() || null;
        break;
      }
    }
  }
  return getPathComponents(activeDocPath);
};

const getRelativePath = function(path, anchorPath) {
  if (anchorPath == null) {
    return '/' + path.join('/');
  }
  let commonAncestorDepth = 0;
  for (let i = 0; i < Math.min(path.length, anchorPath.length); i++) {
    if (path[i] != anchorPath[i]) {
      break;
    }
    commonAncestorDepth = i + 1;
  }
  return ('../'.repeat(anchorPath.length - commonAncestorDepth)
    + path.slice(commonAncestorDepth).join('/'));
};

const getMarkdownLink = function(path) {
  const escapedText = $(path).lastPathComponent.js.replace(/([#_*/()<>])/g, '\\$1').replace(/([\[\]])/g, '\\\\$1');
  const escapedPath = (path
    .replace(/[(]/g, '%28')
    .replace(/[)]/g, '%29')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D'));
  return `[${escapedText}](${escapedPath})`;
};

function run(args) {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const activeDocDirPath = getActiveTyporaDocPath();
  // Get the directory path.
  if (activeDocDirPath) {
    activeDocDirPath.pop();
  }
  const relativePaths = args[0].split('\t').map(getPathComponents).map(p => getRelativePath(p, activeDocDirPath));

  return relativePaths.map(getMarkdownLink).join('\n\n');
}

