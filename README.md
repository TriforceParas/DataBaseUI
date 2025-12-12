# DB+ SQL Manager

A modern, high-performance desktop SQL client built with Tauri, React, and Rust. Designed for safety and ease of use, featuring a unique "Changelog" system for pending edits.

## Features

### 🛡️ Connection Isolation & Safety

- **Safe Switching**: Automatically clears workspace state when switching databases to prevent cross-contamination.
- **Unsaved Warning**: Prompts you before switching if you have pending changes.

### 📝 Changelog System

- **Pending Edits**: Updates and Deletes are not applied immediately. They are queued as "Pending Changes".
- **Visual Feedback**:
  - 🟥 **Deletes**: Rows marked for deletion are highlighted in red.
  - 🟨 **Updates**: Edited cells are highlighted in yellow.
- **Review & Commit**: Review all pending changes in the dedicated Changelog sidebar before confirming them to the database.

### 🔌 Connectivity

- Support for multiple database types (PostgreSQL, MySQL, SQLite) via SQLx.
- Manage locally saved connections.

### 📊 Data Management

- **Interactive Grid**: Sort, select, and copy/export data (JSON/CSV).
- **Tagging**: Organize your tables with custom colored tags for easy navigation.
- **Query Editor**: Execute raw SQL queries with a responsive editor.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, CSS Modules, Lucide React (Icons), DnD Kit.
- **Backend (Desktop)**: Tauri (Rust), SQLx.
- **Local Storage**: SQLite (for app configuration and connections).

## Getting Started

### Prerequisites

- Node.js (v16+)
- Rust (latest stable)
- VS Code (Recommended) with Tauri + rust-analyzer extensions.

### Installation

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd SQL-UI
   ```

2. Install frontend dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run tauri dev
   ```

4. Build for production:

   ```bash
   npm run tauri build
   ```

## License

[MIT](LICENSE)
