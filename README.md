# Properties Commander

Advanced frontmatter properties management plugin for [Obsidian](https://obsidian.md) - Add, Remove, and Edit properties (key-value pairs) across files and folders with ease.

![Obsidian](https://img.shields.io/badge/Obsidian-v1.0.0+-7C3AED?logo=obsidian&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### ➕ Add Properties

- Add multiple properties at once
- Supports multiple value types:
  - **Text** - Plain text values
  - **Number** - Numeric values
  - **Checkbox** - Boolean true/false
  - **Date** - Date picker (YYYY-MM-DD format)
  - **List** - Comma-separated lists
- Add as many properties as needed in one operation

### 🗑️ Remove Properties

- Batch removal with toggle switches
- Visual list of all properties in selected files
- Shows property keys with value previews
- Remove multiple properties at once

### ✏️ Edit Properties

Two editing modes:

**Rename Key Mode:**

- Change the property key name
- Preserves the existing value

**Update Value Mode:**

- Change the value of an existing property
- Select value type (text, number, checkbox, date, list)
- Option to add property to files that don't have it

### 📁 Folder Operations

- Process entire folders at once
- **Include Subfolders** toggle
- **Depth Level** selector (1, 2, 3, 5, 10, or infinite)

## Usage

### Context Menu (File Explorer)

1. Right-click on a file, multiple files, or a folder in the file explorer
2. Select **"Properties Commander"** from the context menu
3. Choose: **Add Properties**, **Remove Properties**, or **Edit Properties**

### Command Palette

Press `Ctrl/Cmd + P` and search for:

- **"Properties Commander: Add Properties..."**
- **"Properties Commander: Remove Properties..."**
- **"Properties Commander: Edit Properties..."**

Each command opens a selection modal where you can:

- Select a folder (with subfolder options)
- Select individual files

## Example

### Adding Properties

Add `status: draft` and `priority: high` to multiple files at once:

```yaml
---
status: draft
priority: high
---
```

### Editing Properties

Rename `status` to `state`, or update all `priority` values to `medium`.

### Removing Properties

Select and remove `draft`, `temp`, or any other properties you no longer need.

## Installation

### From Obsidian Community Plugins

1. Open **Settings** → **Community plugins**
2. Click **Browse** and search for "Properties Commander"
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [releases page](https://github.com/karolprzygoda/properties-commander/releases)
2. Create folder: `YourVault/.obsidian/plugins/properties-commander/`
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable the plugin in **Settings** → **Community plugins**

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- ppnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/karolprzygoda/properties-commander.git
cd properties-commander

# Install dependencies
pnpm install

# Build for production
pnpm run build

# Development mode (watch for changes)
pnpm run dev
```

## Related Plugins

- [Tag Commander](https://github.com/karolprzygoda/obsidian-tag-commander) - Advanced tag management for Obsidian

## License

MIT License - see [LICENSE](LICENSE) for details.
