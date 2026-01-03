# Super Bookmarks

A Chrome extension for capturing notes, links, and content with semantic search. Highlight text on any webpage, right-click to save, and find it later using natural language queries.

## Features

### Capture
- **Right-click to save** - Highlight text on any page, right-click to add to your bookmarks
- **One bookmark per URL** - Multiple selections from the same page automatically append to the existing bookmark
- **Auto-save** - Every addition is immediately saved to the database
- **Progressive capture** - Keep adding content from the same article without manual saving

### Search
- **Semantic search** - Find bookmarks by meaning, not just keywords
- **Local embeddings** - Uses all-MiniLM-L6-v2 to generate text embeddings in your browser
- **Hybrid search** - Combines vector similarity with keyword matching for best results
- **Tag search** - Use `tag:` prefix for tag-only filtering (e.g., `tag: javascript`)

### Organize
- **Tags** - Add tags with autocomplete suggestions
- **Browse** - View all bookmarks with sorting options
- **Bulk actions** - Select multiple items to export or delete
- **Edit mode** - Update bookmark content, title, and tags

### Export
- **Markdown export** - Download bookmarks as readable markdown
- **Browser preview** - View bookmarks in a styled HTML page
- **Full backup** - Export everything including AI embeddings for migration
- **Restore** - Import backups to another browser or device

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `super_bookmarks` folder
5. The extension icon will appear in your toolbar

## Usage

### Adding Bookmarks
1. Click the extension icon to open the side panel
2. Highlight text on any webpage
3. Right-click and select "Add to Super Bookmarks"
4. The text is automatically saved with the page URL and title
5. Continue highlighting more text - it appends to the same bookmark

### Searching
1. Open the side panel and click the "Search" tab
2. Type a natural language query (e.g., "articles about machine learning")
3. Vector search finds semantically similar content, not just keyword matches
4. First search loads the embedding model (~23MB, cached after first load)

### Editing
1. Click on any bookmark card to expand it
2. Click "Edit" to modify the content
3. The URL field is locked (it's the unique identifier)
4. Click "Update Bookmark" to save or "Delete" to remove

## Architecture

```
super_bookmarks/
├── background/           # Service worker & context menus
├── content/              # Content script for page interaction
├── lib/
│   ├── db/               # IndexedDB database layer
│   ├── embeddings/       # AI model & vector search
│   ├── export/           # Backup & export utilities
│   ├── store/            # State management
│   └── vendor/           # Bundled transformers.js
├── panel/
│   ├── components/       # Reusable UI components
│   ├── views/            # Main view controllers
│   ├── styles/           # CSS
│   └── utils/            # DOM helpers & formatters
└── manifest.json
```

### Key Technologies
- **Chrome Extension Manifest V3** - Modern extension architecture
- **IndexedDB** - Local database for bookmarks and embeddings
- **Transformers.js** - Run ML models in the browser via WebAssembly
- **all-MiniLM-L6-v2** - 384-dimensional sentence embeddings
- **Web Workers** - Embedding generation in background thread

## Development

No build step required - the extension runs directly from source.

### Project Structure
- `background/service-worker.js` - Extension lifecycle & message routing
- `lib/embeddings/embedding-worker.js` - AI model loading & inference
- `lib/embeddings/vector-search.js` - Cosine similarity search
- `lib/db/database.js` - IndexedDB wrapper with full CRUD
- `panel/panel.js` - Main UI controller

### Adding Features
1. Views go in `panel/views/`
2. Reusable components in `panel/components/`
3. Database operations in `lib/db/database.js`
4. State shape defined in `lib/store/app-state.js`

## Privacy

- **100% local** - All data stays in your browser
- **No server** - Embedding model runs locally via WebAssembly
- **No tracking** - No analytics or external requests
- **Your data** - Export anytime, delete anytime

## License

MIT
