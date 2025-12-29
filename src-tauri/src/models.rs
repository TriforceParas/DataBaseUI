use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Connection {
    pub id: i64,
    pub name: String,
    pub connection_string: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct TableTag {
    pub table_name: String,
    pub connection_id: i64,
    pub tag_id: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ColumnSchema {
    pub name: String,
    pub type_name: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub is_auto_increment: bool,
    pub is_unique: bool,
    pub default_value: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct SavedQuery {
    pub id: i64,
    pub name: String,
    pub query: String,
    pub connection_id: i64,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct SavedFunction {
    pub id: i64,
    pub name: String,
    pub function_body: String,
    pub connection_id: i64,
    pub created_at: String,
}
