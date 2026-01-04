# DB+ SQL Manager

A modern, high-performance desktop SQL client built with Tauri, React, and Rust. Designed for safety, speed, and intuitive organization, featuring a unique "Changelog" system for pending edits and a powerful visual tagging system.

## ✨ Key Features

### 🎨 Visual Organization & Navigation
- **Smart Tagging System**: Organize your tables not just alphabetically, but logically. Create custom colored tags and use **Drag & Drop** to assign tables to them.
- **Dual Sidebar Modes**: Toggle between a standard **A-Z** list and a **Tags** view to focus on relevant groups of tables.
- **Database-Aware Tabs**: Open multiple tables, queries, and functions simultaneously. Tabs are intelligently scoped to their specific database, ensuring no confusion between identical table names across different environments.
- **Preview & Pin**: Single-click to preview a table, double-click to pin it to your workspace.

### �️ Safe Data Editing (The Changelog System)
Never accidentally break production data again.
- **Pending Edits Queue**: Updates, Insertions, and Deletions are not applied immediately. They are queued as "Pending Changes".
- **Visual Diff**: 
  - 🟥 **Deletes**: Rows marked for deletion are highlighted in red.
  - 🟨 **Updates**: Individual modified cells are highlighted in yellow.
  - 🟩 **Inserts**: New rows are clearly distinct.
- **Review & Commit**: Review every granular change in the dedicated **Changelog Sidebar** before confirming the transaction.

### � Saved Resources
- **Saved Queries**: Write complex SQL once and save it for repeated use. Accessible directly from the sidebar.
- **Saved Functions**: Manage and execute stored database functions with a dedicated runner interface.

### 📊 Powerful Data Grid
- **Interactive Grid**: Sort, filter, and resize columns with ease.
- **Context Menu**: Right-click for quick actions like Copy, Export (CSV/JSON), or specialized table operations.
- **Pagination**: Efficiently handle large datasets with server-side pagination.

### 🔌 Connectivity & Multi-Database
- **Seamless Switching**: Switch between different databases within the same connection instantly via the sidebar dropdown.
- **Connection Isolation**: Workspace state is strictly scoped to the active database to prevent cross-contamination.
- **Broad Support**: Connect to PostgreSQL, MySQL, and SQLite databases.

### 🛠️ Developer Tools
- **System Logs**: A dedicated log tab tracks every action, query execution, and error, with status filtering (e.g., "Hide Success") for easy debugging.
- **Schema Diagram & Management**: visual schema exploration (in progress) and table structure management.
- **SQL Editor**: Full-featured editor for running raw SQL commands.

---

## 💻 Tech Stack

- **Frontend**: 
  - **Framework**: React 18 + TypeScript
  - **Build Tool**: Vite
  - **Styling**: CSS Modules (scoped & performant)
  - **UI Components**: Custom-built with `lucide-react` icons and `@dnd-kit` for complex drag-and-drop interactions.

- **Backend (Desktop)**: 
  - **Core**: Tauri (Rust)
  - **Database Driver**: `sqlx` (Async, type-safe SQL)
  - **Local Store**: SQLite (for app configuration, tags, and saved changes).

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- Rust (latest stable)
- VS Code (Recommended) with Tauri + rust-analyzer extensions.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/TriforceParas/DataBaseUI.git
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

## 📄 License

[MIT](LICENSE)
