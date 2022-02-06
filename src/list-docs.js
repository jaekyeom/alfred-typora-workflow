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

function run() {
  ObjC.import('stdlib');
  ObjC.import('Foundation');

  const app = Application("Typora");
  const alfredWorkflowCachePath = $($.getenv('alfred_workflow_cache')).stringByStandardizingPath.js;

  const currTimestamp = Date.now();
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
    if (!openDocsCache || (currTimestamp - openDocsCache['timestamp'] > 1000)) {
      needRerunning = true;
      asyncUpdateDocListCache();
    }
    if (openDocsCache) {
      items = openDocsCache['openDocs'];
      items.forEach(function(e) {
        addedDocs.add(e['subtitle']);
      });
    }
  }

  const listOnlyOpenDocs = parseInt($.getenv('LIST_ONLY_OPEN_DOCS'));
  if (!listOnlyOpenDocs) {
    const docsFromDiskCache = readJSONFile(alfredWorkflowCachePath + '/docs_from_disk_cache.json');
    if (!docsFromDiskCache || (currTimestamp - docsFromDiskCache['timestamp'] > 1000)) {
      needRerunning = true;
      if (!app.running()) {
        asyncUpdateDocListCache();
      }
    }
    if (docsFromDiskCache) {
      items.push(...(docsFromDiskCache['docsFromDisk'].filter(function(e) {
        return !addedDocs.has(e['subtitle']);
      })));
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
    result['rerun'] = 0.1;
  }

  return JSON.stringify(result);
}

