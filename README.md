# Alfred Typora Workflow

Alfred workflow for [Typora](https://typora.io/).  

<p align="center">
<img alt="Typora workflow screenshot" src="./screenshot.png" width="70%" />
</p>

## Installation

Download and install [Typora-Documents.alfredworkflow](https://github.com/jaekyeom/alfred-typora-workflow/releases/latest/download/Typora-Documents.alfredworkflow).

## Usage

### Querying documents

- `ty {query}`: Query Typora documents. It automatically searches the parent Git repositories or directories for markdown files.
- `ty* {query}`: Query Typora documents and all types of files from the parent Git repositories or directories, *regardless of `LIST_ONLY_OPEN_DOCS`*.
- User actions
  - `↩`: Open/activate the selected document or file.
  - `⌥ + ↩`: Close the selected document (if it's open).
  - `⌘ + ↩`: Reveal file in Finder.

### Copying relative markdown links to any files/directories

- (Universal) [File Action](https://www.alfredapp.com/blog/tips-and-tricks/file-actions-from-alfred-or-finder/) `Copy relative links for Typora`: Copy markdown link(s) to the given file/directory path(s) relative to Typora's *active* document.
  - One simple use case is pressing `⌘ + ⌥ + \` in Finder and invoking this File Action.
  - It escapes paths and names according to the markdown syntax.
  - It is especially useful for copying links to files that Typora doesn't support the drag-and-drop link insertion from Finder, such as `.docx`, `.tex`, and `.md` files.

## Configurations

- `LIST_ONLY_OPEN_DOCS`: If set to 0 (default), `ty` queries open documents and markdown files from the parent Git repositories or directories. If set to 1, `ty` only queries open documents.
- `NUM_RECENT_DIRS`: The number of recent directories to keep and list files from. Set this to 0 to disable it. 5 by default.

## Credits

- [alfred-browser-tabs](https://github.com/epilande/alfred-browser-tabs) for the structure of the workflow.
- [OneUpdater](https://github.com/vitorgalvao/alfred-workflows/tree/master/OneUpdater) for the automatic updater node.

## License

MIT

