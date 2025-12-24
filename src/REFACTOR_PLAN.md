# 🏗️ Refactoring & Organization Plan for SQL-UI

This plan outlines the steps to modernize, modularize, and clean up the `src` folder.

## ✅ Completed Tasks

- [x] **Directory Structure**: Created `src/api`, `src/components/datagrid`, `src/components/editors`, etc.
- [x] **API Layer**: Centralized all backend calls in `src/api/commands.ts`.
- [x] **DataGrid Refactor**: Split into `GridHeader`, `GridRow`, `GridCell`, and `ContextMenu`.
- [x] **CSS Modules**: Implemented `DataGrid.module.css`.
- [x] **Barrel Exports**: Created `index.ts` files for component folders.
- [x] **Initial Hook Extraction**: Extracted `useTableData`, `useSavedItems`, etc.

---

## 📅 Remaining Tasks

### 1. 📂 Type Definitions Refactor

**Goal:** Split the monolithic `src/types.ts` into domain-specific files to avoid circular dependencies and improve readability.

- **Action**: Create `src/types/` directory (if not fully utilized) and split `types.ts`:
  - `src/types/models.ts`: Database entities (`Connection`, `Tag`, `SavedQuery`, `ColumnSchema`).
  - `src/types/api.ts`: API responses (`QueryResult`, `PendingChange`).
  - `src/types/ui.ts`: UI state (`TabItem`, `SortState`, `PaginationState`).
  - `src/types/index.ts`: Export all.

### 2. 🧠 MainInterface Logic Extraction

**Goal:** Reduce `MainInterface.tsx` size by moving complex handlers to custom hooks.

- **`useSchemaOperations` Hook**:
  - Move `handleGetTableSchema` and `handleEditTableSchema` logic here.
  - Should expose: `{ viewSchema, editSchema }`.
- **`useDataMutation` Hook**:
  - Move `handlePanelSubmit` (INSERT/UPDATE logic) here.
  - This is a large, complex function that deals with pending changes and SQL generation.

### 3. 🎨 MainLayout Separation (The Final Split)

- [x] Extract `useAppNavigation` (Table clicks, saved items, logs)
- [x] Extract `MainViewContent` component
**Goal:** Make `MainInterface.tsx` a pure Container Component and `MainLayout.tsx` a pure Presentational Component.

- **Create `src/components/MainLayout.tsx`**:
  - Props: `system`, `tabs`, `data`, `actions`, `modals`.
  - Responsibility: Render `Sidebar`, `Navbar`, `TabBar`, `MainViewContent`, and `ModalManager`.
- **Update `MainInterface.tsx`**:
  - Responsibility: Call all hooks (`useAppSystem`, `useTableData`, etc.).
  - Pass the resulting state and functions down to `MainLayout`.

### 4. 🧹 Final Cleanup

- Remove unused imports/types.

- Ensure all new files have proper barrel exports.
- Verify no inline `invoke()` calls remain in UI components.
