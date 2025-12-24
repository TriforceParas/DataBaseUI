use sqlx::{AnyConnection, Connection as SqlxConnection};

pub fn detect_db_type(url: &str) -> Result<&str, String> {
    if url.starts_with("postgres:") || url.starts_with("postgresql:") {
        Ok("postgres")
    } else if url.starts_with("mysql:") {
        Ok("mysql")
    } else if url.starts_with("sqlite:") {
        Ok("sqlite")
    } else {
        Err("Unsupported database type".to_string())
    }
}

pub async fn connect_to_db(url: &str) -> Result<AnyConnection, String> {
    <AnyConnection as SqlxConnection>::connect(url)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))
}

pub fn split_sql_statements(sql: &str, support_backslash_escape: bool) -> Vec<String> {
    let mut stmts = Vec::new();
    let mut current = String::new();
    let mut chars = sql.chars().peekable();

    let mut in_quote = false;
    let mut quote_char = '\0';
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some(c) = chars.next() {
        if in_line_comment {
            current.push(c);
            if c == '\n' {
                in_line_comment = false;
            }
            continue;
        }

        if in_block_comment {
            current.push(c);
            if c == '*' {
                if let Some(&next_c) = chars.peek() {
                    if next_c == '/' {
                        chars.next();
                        current.push('/');
                        in_block_comment = false;
                    }
                }
            }
            continue;
        }

        if in_quote {
            current.push(c);
            if support_backslash_escape && c == '\\' {
                if let Some(&next_c) = chars.peek() {
                    chars.next();
                    current.push(next_c);
                }
                continue;
            }
            if c == quote_char {
                if let Some(&next_c) = chars.peek() {
                    if next_c == quote_char {
                        chars.next();
                        current.push(next_c);
                        continue;
                    }
                }
                in_quote = false;
            }
            continue;
        }

        match c {
            '-' => {
                current.push(c);
                if let Some(&next_c) = chars.peek() {
                    if next_c == '-' {
                        chars.next();
                        current.push('-');
                        in_line_comment = true;
                    }
                }
            }
            '/' => {
                current.push(c);
                if let Some(&next_c) = chars.peek() {
                    if next_c == '*' {
                        chars.next();
                        current.push('*');
                        in_block_comment = true;
                    }
                }
            }
            '\'' | '"' | '`' => {
                in_quote = true;
                quote_char = c;
                current.push(c);
            }
            ';' => {
                if !current.trim().is_empty() {
                    stmts.push(current.trim().to_string());
                }
                current = String::new();
            }
            _ => current.push(c),
        }
    }

    if !current.trim().is_empty() {
        stmts.push(current.trim().to_string());
    }

    stmts
}
