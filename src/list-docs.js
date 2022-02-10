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

const constructOpenDocItem = function(rawItem) {
  const name = rawItem['name'];
  // Untitled documents have no paths.
  const path = rawItem['path'] || rawItem['name'];
  const hasPath = !!rawItem['path'];
  return {
    title: name,
    subtitle: path,
    quicklookurl: (hasPath ? path : null),
    match: `${name} ${path.replace(
      /[^A-Za-z0-9]/g,
      " ",
    )}`,
    icon: { path: rawItem['modified'] ? 'icon_accented.png' : 'icon.png' },
    arg: `${rawItem['windowId']},${path}`,
    action: (hasPath ? {
      file: path,
    } : {
      text: name,
    }),
    mods: {
      alt: {
        valid: true,
        arg: `${rawItem['windowId']},${path}`,
        subtitle: `Close ${name}${rawItem['modified'] ? " (Edited)" : ""}`,
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
  };
};

const constructDocFromDiskItem = function(rawItem) {
  const name = rawItem['name'];
  const path = rawItem['path'];
  return {
    title: name,
    subtitle: path,
    quicklookurl: path,
    match: `${name} ${path.replace(
      /[^A-Za-z0-9]/g,
      " ",
    )}`,
    icon: (name.endsWith('.md') ? {
      path: 'icon_dimmed.png',
    } : {
      type: 'fileicon',
      path: path,
    }),
    arg: path,
    action: {
      file: path,
    },
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
  };
};

function run() {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const app = Application("Typora");
  const alfredWorkflowCachePath = $($.getenv('alfred_workflow_cache')).stringByStandardizingPath.js;

  const currTimestamp = Date.now();
  let initialRunTimestamp = null;
  try {
    initialRunTimestamp = parseInt($.getenv('initialRunTimestamp'));
  } catch (e) {
  }
  let needRerunning = false;
  let items = [];
  const addedDocs = new Set();

  if (!app.running()) {
    items.push({
      title: `Typora is not running`,
      subtitle: `Press enter to launch Typora`,
      variables: {
        isOpen: true,
      },
    });
  } else {
    const openDocsCache = readJSONFile(alfredWorkflowCachePath + '/open_docs_cache.json');
    if (!openDocsCache ||
        openDocsCache['version'] != 2 ||
        !initialRunTimestamp ||
        initialRunTimestamp > openDocsCache['timestamp']) {
      needRerunning = true;
      if (!initialRunTimestamp) {
        asyncUpdateDocListCache();
      }
    }
    if (openDocsCache) {
      openDocsCache['openDocsRaw'].forEach(function(e) {
        addedDocs.add(e['path'] || e['name']);
      });
      items = openDocsCache['openDocsRaw'].map(constructOpenDocItem);
    }
  }

  const listOnlyOpenDocs = parseInt($.getenv('LIST_ONLY_OPEN_DOCS'));
  const listOnlyMarkdownFiles = parseInt($.getenv('LIST_ONLY_MARKDOWN_FILES'));
  if (!listOnlyOpenDocs) {
    const docsFromDiskCache = readJSONFile(alfredWorkflowCachePath + '/docs_from_disk_cache.json');
    if (!docsFromDiskCache ||
        docsFromDiskCache['version'] != 2 ||
        !initialRunTimestamp ||
        initialRunTimestamp > docsFromDiskCache['timestamp']) {
      needRerunning = true;
      if (!initialRunTimestamp && !app.running()) {
        asyncUpdateDocListCache();
      }
    }
    if (docsFromDiskCache) {
      items.push(...(docsFromDiskCache['markdownDocsFromDiskRaw'].filter(function(e) {
        return !addedDocs.has(e['path']);
      }).map(constructDocFromDiskItem)));
      if (!listOnlyMarkdownFiles) {
        items.push(...(docsFromDiskCache['otherFilesFromDiskRaw'].filter(function(e) {
          return !addedDocs.has(e['path']);
        }).map(constructDocFromDiskItem)));
      }
    }
  }

  if (items.length == 0) {
    items.push({
      valid: false,
      title: `Loading data`,
      subtitle: `Please wait while loading data...`,
    });
  }

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

