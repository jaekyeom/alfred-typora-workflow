#!/usr/bin/env osascript -l JavaScript

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

const asyncUpdateDocListCache = function() {
  // For some reason, curr.doShellScript() (with includeStandardAdditions=true) doesn't work.
  $.system("nohup ./update-doc-list-cache.js > /dev/null &");
};

const searchFileContentsWithMdfind = function(curr, targetDirs, queryStrs, queryStrJoiner, searchOnlyMarkdownFiles) {
  const argsTargetDirs = (targetDirs
    .map(d => `-onlyin '${d.replace(/'/g, "\\'")}'`)
    .join(' '));
  let queryPrefixFiletype = (
    searchOnlyMarkdownFiles
    ? '(kMDItemDisplayName == "*.md" || kMDItemContentType == "com.unknown.md") && '
    : '');
  if (!searchOnlyMarkdownFiles && queryStrs.length > 1 && queryStrs[0].startsWith('.')) {
    queryPrefixFiletype = `(kMDItemDisplayName == "*${queryStrs[0]}") && `;
    queryStrs.shift();
  }
  const queryMain = (queryStrs
    .map(q => `kMDItemTextContent == "${q.replace(/'/g, "\\'").replace(/"/g, '\\"')}"cd`)
    .join(queryStrJoiner));
  const results = curr.doShellScript(`mdfind ${argsTargetDirs} '${queryPrefixFiletype} (${queryMain})'`);
  if (results.length == 0) {
    return [];
  }
  return results.split('\r');
};

function run(args) {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const app = Application("Typora");
  const workflowVersion = $.getenv('alfred_workflow_version');
  const alfredWorkflowCachePath = $($.getenv('alfred_workflow_cache')).stringByStandardizingPath.js;
  const searchOnlyOpenDocs = parseInt($.getenv('SEARCH_ONLY_OPEN_DOCS_CONTENTS'));

  const currTimestamp = Date.now();
  let initialRunTimestamp = null;
  try {
    initialRunTimestamp = parseInt($.getenv('initialRunTimestamp'));
  } catch (e) {
  }
  let needRerunning = false;
  const items = [];
  const addedDocs = new Set();

  const curr = Application.currentApplication();
  curr.includeStandardAdditions = true;

  const searchOnlyMarkdownFiles = parseInt(args[0]);
  const queryStrRaw = args[1];

  const openDocs = {};
  let targetDirs = null;

  if (app.running()) {
    const openDocsCache = readJSONFile(alfredWorkflowCachePath + '/open_docs_cache.json');
    if (!openDocsCache ||
        openDocsCache['version'] != workflowVersion ||
        !initialRunTimestamp ||
        initialRunTimestamp > openDocsCache['timestamp']) {
      needRerunning = true;
      if (!initialRunTimestamp) {
        asyncUpdateDocListCache();
      }
    }
    if (openDocsCache) {
      openDocsCache['openDocsRaw'].forEach(function(e) {
        e['path'] && (openDocs[e['path']] = e);
      });
      if (searchOnlyOpenDocs && searchOnlyMarkdownFiles) {
        targetDirs = openDocsCache['projectDirs'];
      }
    }
  }

  if (!searchOnlyOpenDocs || !searchOnlyMarkdownFiles) {
    const docsFromDiskCache = readJSONFile(alfredWorkflowCachePath + '/docs_from_disk_cache.json');
    if (!docsFromDiskCache ||
        docsFromDiskCache['version'] != workflowVersion ||
        !initialRunTimestamp ||
        initialRunTimestamp > docsFromDiskCache['timestamp']) {
      needRerunning = true;
      if (!initialRunTimestamp && !app.running()) {
        asyncUpdateDocListCache();
      }
    }
    if (docsFromDiskCache) {
      targetDirs = docsFromDiskCache['projectDirs'];
    }
  }

  if (!targetDirs) {
    items.push({
      valid: false,
      title: `Loading data`,
      subtitle: `Please wait while loading data...`,
    });
  } else {
    const constructItem = function(path) {
      const name = $(path).lastPathComponent.js;
      return {
        title: name,
        subtitle: path,
        quicklookurl: path,
        icon: (name.endsWith('.md') ? {
          path: (openDocs[path]
            ? (openDocs[path]['modified'] ? 'icon_accented.png' : 'icon.png')
            : 'icon_dimmed.png'),
        } : {
          type: 'fileicon',
          path: path,
        }),
        arg: (openDocs[path]
          ? `${openDocs[path]['windowId']},${path}`
          : path),
        action: {
          file: path,
        },
        mods: {
          alt: (openDocs[path]
            ? {
              valid: true,
              arg: `${openDocs[path]['windowId']},${path}`,
              subtitle: `Close ${name}${openDocs[path]['modified'] ? " (Edited)" : ""}`,
            } : undefined),
          cmd: {
            valid: true,
            arg: path,
            subtitle: `Reveal file in Finder`,
          },
        },
        variables: {
          isOpen: !!openDocs[path],
        },
      };
    };

    const searchResultHandler = function(path) {
      if (searchOnlyOpenDocs && !openDocs[path]) {
        return;
      }
      if (!addedDocs.has(path)) {
        items.push(constructItem(path));
        addedDocs.add(path);
      }
    };

    if (queryStrRaw.length == 0) {
      if (app.running()) {
        const openDocsCache = readJSONFile(alfredWorkflowCachePath + '/open_docs_cache.json');
        if (openDocsCache) {
          openDocsCache['openDocsRaw'].forEach(function(e) {
            e['path'] && searchResultHandler(e['path']);
          });
        }
      }
      if (!searchOnlyOpenDocs || !searchOnlyMarkdownFiles) {
        const docsFromDiskCache = readJSONFile(alfredWorkflowCachePath + '/docs_from_disk_cache.json');
        if (docsFromDiskCache) {
          docsFromDiskCache['docsFromDiskRaw'].forEach(function(e) {
            searchResultHandler(e['path']);
          });
        }
        if (!searchOnlyMarkdownFiles) {
          const otherFilesFromDiskCache = readJSONFile(alfredWorkflowCachePath + '/other_files_from_disk_cache.json');
          if (!otherFilesFromDiskCache ||
              otherFilesFromDiskCache['version'] != workflowVersion ||
              !initialRunTimestamp ||
              initialRunTimestamp > otherFilesFromDiskCache['timestamp']) {
            needRerunning = true;
          }
          if (otherFilesFromDiskCache) {
            otherFilesFromDiskCache['otherFilesFromDiskRaw'].forEach(function(e) {
              searchResultHandler(e['path']);
            });
          }
        }
      }
    } else {
      searchFileContentsWithMdfind(
        curr, targetDirs, [`${queryStrRaw}`], ' && ', searchOnlyMarkdownFiles).forEach(searchResultHandler);
      searchFileContentsWithMdfind(
        curr, targetDirs, [`${queryStrRaw}*`], ' && ', searchOnlyMarkdownFiles).forEach(searchResultHandler);
      const queryStrsSplitted = [];
      {
        const querySplitRe = /[^\s"]+|"([^"]*)"/gi;
        let m;
        do {
          m = querySplitRe.exec(queryStrRaw);
          if (m) {
            queryStrsSplitted.push(m[1] || m[0]);
          }
        } while (m);
      }
      searchFileContentsWithMdfind(
        curr, targetDirs, queryStrsSplitted, ' && ', searchOnlyMarkdownFiles).forEach(searchResultHandler);
    }

    if (items.length == 0) {
      items.push({
        valid: false,
        title: `No matched contents`,
        subtitle: `No files with matched contents for the query...`,
      });
    }
  }

  // This lets Alfred keep the selected item across different runs in the same session.
  items.forEach(function(e) {
    e['uid'] = `${e['subtitle']}--${initialRunTimestamp || currTimestamp}`;
  })

  const result = {
    items,
  };
  if (needRerunning) {
    result['variables'] = {
      initialRunTimestamp: `${initialRunTimestamp || currTimestamp}`,
    };
    result['rerun'] = 0.1;
  }

  return JSON.stringify(result);
}

