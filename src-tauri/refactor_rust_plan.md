# 🦀 Rust Backend Refactoring Plan

Modularize the Tauri backend to improve maintainability, split the large `commands.rs`, and implement structured error handling.

## 📂 Proposed File Structure

```text
src-tauri/src/
├── commands/
│   ├── mod.rs          # Module entry & re-exports
│   ├── connection.rs   # Connection CRUD commands
│   ├── db_ops.rs       # SQL execution, schema inspection, table operations
│   ├── tag.rs          # Tag & Table-Tag management
│   ├── saved.rs        # Saved Queries & Functions
│   └── window.rs       # Tauri Window & Loader logic
├── error.rs            # Type-safe Error enum (thiserror)
├── models.rs           # Shared DTOs & Structs
├── utils.rs            # SQL parsing (split_sql) & DB helpers
├── db.rs               # Local App Data (SQLite) initialization
├── lib.rs              # Tauri setup & plugin registration
└── main.rs             # Application entrypoint
```

---

## 🛠️ Step-by-Step Execution

### 1. 🏗️ Foundations

- **[NEW] `models.rs`**: Extract all `derive` structs (`Connection`, `Tag`, `TableTag`, `QueryResult`, `ColumnSchema`).
- **[NEW] `utils.rs`**: Move helper functions like `detect_db_type`, `connect_to_db`, and the complex `split_sql_statements`.
- **[NEW] `error.rs`**: Implement a custom `AppError` enum using `thiserror`.

  ```rust
  #[derive(Debug, thiserror::Error, serde::Serialize)]
  pub enum AppError {
      #[error("Database error: {0}")]
      DbError(String),
      #[error("IO error: {0}")]
      IoError(String),
      // ...
  }
  ```

### 2. 🧩 Command Modularization

Split `commands.rs` into the `commands/` directory:

- **`connection.rs`**: `save_connection`, `list_connections`, `delete_connection`, `update_connection`, `verify_connection`.
- **`db_ops.rs`**: `get_tables`, `get_columns`, `get_table_schema`, `execute_query`, `truncate_table`, `drop_table`, `duplicate_table`.
- **`tag.rs`**: `create_tag`, `update_tag`, `delete_tag`, `get_tags`, `assign_tag`, `remove_tag_from_table`, `get_table_tags`.
- **`saved.rs`**: `save_query`, `list_queries`, `save_function`, `list_functions`, etc.
- **`window.rs`**: `open_connection_window`, `open_loading_window`.

### 3. 🧹 Cleanup & Polishing

- Update `lib.rs` and `main.rs` to reflect new paths.
- Refactor `execute_query` (currently ~200 lines) into smaller helpers for processing MySQL, Postgres, and SQLite specific row conversions.
- Ensure all commands return `Result<T, AppError>`.

---

## ✅ Success Criteria

- [x] Create refined plan (This file)
- [ ] `commands.rs` is deleted.
- [ ] No single file in `src-tauri/src/` exceeds 400 lines (excluding complex SQL parsing in `utils`).
- [ ] Backend compiles and all Tauri `invoke` calls from frontend work as before.
