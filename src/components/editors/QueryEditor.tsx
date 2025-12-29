import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { THEMES } from '../../utils/themeUtils';
import styles from '../../styles/MainLayout.module.css';
import { Play, ChevronDown, Copy, Download, Save, FunctionSquare } from 'lucide-react';

interface QueryEditorProps {
    value: string;
    onChange: (value: string) => void;
    onRunQuery: (query: string) => void;
    // New props
    selectedRowCount?: number;
    onCopy?: (format: 'CSV' | 'JSON') => void;
    onExport?: (format: 'CSV' | 'JSON') => void;
    theme?: string;
    tables?: string[]; // For autocomplete
    // Saved Query props
    onSaveQuery?: () => void;
    onSaveFunction?: () => void;
    onExportSql?: () => void;
    // For saved items - update instead of save
    onSaveChanges?: () => void;
    isSaved?: boolean;
}

const extractQueryAtLine = (model: any, lineNumber: number): string | null => {
    const val = model.getValue();
    const semiIndices = [...val.matchAll(/;/g)].map((m: any) => m.index!);
    const lineStartOff = model.getOffsetAt({ lineNumber: lineNumber, column: 1 });

    // Find nearest preceding ; (or -1)
    const start = semiIndices.filter((i: number) => i < lineStartOff).pop() ?? -1;

    // Find nearest succeeding ; (or end)
    let end = semiIndices.find((i: number) => i >= lineStartOff);
    if (end === undefined) end = val.length;

    const text = val.substring(start + 1, end).trim();
    return text || null;
};

export const QueryEditor: React.FC<QueryEditorProps> = ({
    value, onChange, onRunQuery, selectedRowCount = 0, onCopy, onExport,
    theme = 'midnight-blue', tables = [],
    onSaveQuery, onSaveFunction, onExportSql, onSaveChanges, isSaved = false
}) => {
    // Monaco theme selection: use the app theme ID or fallback
    const editorTheme = `app-${theme}`;
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const providerRef = useRef<any>(null);
    const commandRef = useRef<any>(null);
    const completionProviderRef = useRef<any>(null);

    // Unique command ID for this editor instance to avoid collisions and stale closures
    const commandId = useRef('cmd.runQuery.' + crypto.randomUUID()).current;

    // Dropdown state
    const [activeDropdown, setActiveDropdown] = useState<'copy' | 'export' | null>(null);

    const handleBeforeMount = (monaco: any) => {
        // Register all app themes in Monaco
        Object.values(THEMES).forEach((t: any) => {
            monaco.editor.defineTheme(`app-${t.id}`, {
                base: t.type === 'light' ? 'vs' : 'vs-dark',
                inherit: true,
                rules: [],
                colors: {
                    'editor.background': t.colors['bg-primary'],
                    'editor.foreground': t.colors['text-primary'],
                    'editorCursor.foreground': t.colors['accent-primary'],
                    'editor.lineHighlightBackground': t.colors['bg-secondary'],
                    'editorLineNumber.foreground': t.colors['text-muted'],
                    'editorLineNumber.activeForeground': t.colors['text-primary'],
                    'editorIndentGuide.background': t.colors['border-color'],
                    'editor.selectionBackground': t.colors['accent-primary'] + '40', // 25% opacity
                }
            });
        });
    };

    const handleEditorChange = (val: string | undefined) => {
        if (val !== undefined) {
            onChange(val);
        }
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Clean up previous if any
        if (commandRef.current) {
            commandRef.current.dispose();
        }

        // Register Instance-Specific Command
        // We use a unique ID so this specific editor instance handles its own CodeLens clicks.
        // This ensures 'editor' and 'onRunQuery' in closure are correct.
        commandRef.current = monaco.editor.addCommand({
            id: commandId,
            run: (_: any, lineNumber: number) => {
                const model = editor.getModel();
                const query = extractQueryAtLine(model, lineNumber);
                if (query) {
                    onRunQuery(query);
                }
            }
        });

        // Register CodeLens Provider
        if (!providerRef.current) {
            providerRef.current = monaco.languages.registerCodeLensProvider('sql', {
                provideCodeLenses: function (model: any) {
                    // Critical check: Only provide lenses if this model belongs to this editor instance.
                    if (editor.getModel() !== model) {
                        return { lenses: [], dispose: () => { } };
                    }

                    const fullText = model.getValue();
                    const lensRanges: Set<number> = new Set();

                    // Pass 1: Add lens at first non-whitespace line
                    const firstContent = fullText.match(/\S/);
                    if (firstContent && firstContent.index !== undefined) {
                        const p = model.getPositionAt(firstContent.index);
                        lensRanges.add(p.lineNumber);
                    }

                    // Pass 2: Add lens after every semi-colon
                    let match;
                    const re = /;/g;
                    while ((match = re.exec(fullText)) !== null) {
                        const nextCharIdx = match.index + 1;
                        if (nextCharIdx >= fullText.length) continue;

                        const remaining = fullText.substring(nextCharIdx);
                        const nextContentMatch = remaining.match(/\S/);

                        if (nextContentMatch && nextContentMatch.index !== undefined) {
                            const absIndex = nextCharIdx + nextContentMatch.index;
                            const p = model.getPositionAt(absIndex);
                            lensRanges.add(p.lineNumber);
                        }
                    }

                    return {
                        lenses: Array.from(lensRanges).map(line => ({
                            range: {
                                startLineNumber: line,
                                startColumn: 1,
                                endLineNumber: line,
                                endColumn: 1
                            },
                            command: {
                                id: commandId,
                                title: '▶ Run',
                                arguments: [line]
                            }
                        })),
                        dispose: () => { }
                    };
                },
                resolveCodeLens: function (_model: any, codeLens: any) {
                    return codeLens;
                }
            });
        }

        // Register SQL Completion Provider
        if (!completionProviderRef.current) {
            const sqlKeywords = [
                'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
                'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX',
                'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT',
                'NULL', 'IS', 'IN', 'LIKE', 'BETWEEN', 'ORDER', 'BY', 'ASC', 'DESC',
                'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'AS', 'COUNT', 'SUM',
                'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION',
                'ALL', 'EXISTS', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CASCADE',
                'TRUNCATE', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'USE', 'DATABASE', 'SCHEMA'
            ];

            completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
                provideCompletionItems: (model: any, position: any) => {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };

                    const suggestions: any[] = [];

                    // Add SQL keywords
                    sqlKeywords.forEach(kw => {
                        suggestions.push({
                            label: kw,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: kw,
                            range: range,
                            detail: 'SQL Keyword'
                        });
                    });

                    // Add table names
                    tables.forEach(tableName => {
                        suggestions.push({
                            label: tableName,
                            kind: monaco.languages.CompletionItemKind.Class,
                            insertText: tableName,
                            range: range,
                            detail: 'Table'
                        });
                    });

                    return { suggestions };
                }
            });
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (providerRef.current) {
                providerRef.current.dispose();
            }
            if (commandRef.current) {
                commandRef.current.dispose();
            }
            if (completionProviderRef.current) {
                completionProviderRef.current.dispose();
            }
        };
    }, []);

    // Close dropdowns
    useEffect(() => {
        const handleClick = () => setActiveDropdown(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top Toolbar */}
            <div style={{
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => onRunQuery(value)}
                        title="Run all queries (Ctrl+Enter)"
                    >
                        <Play size={14} fill="currentColor" /> Run All
                    </button>

                    {(selectedRowCount > 0) && (
                        <>
                            <div className={styles.verticalDivider} style={{ height: '20px', margin: '0 0.5rem' }} />

                            <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
                                <button
                                    className={styles.outlineBtn}
                                    onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Copy size={14} /> Copy Selected ({selectedRowCount}) <ChevronDown size={12} />
                                </button>
                                {activeDropdown === 'copy' && (
                                    <div className={styles.dropdownMenu} style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '4px',
                                        backgroundColor: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        zIndex: 100,
                                        width: '120px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <div
                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}
                                            className={styles.dropdownItem}
                                            onClick={() => { onCopy?.('CSV'); setActiveDropdown(null); }}
                                        >
                                            As CSV
                                        </div>
                                        <div
                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}
                                            className={styles.dropdownItem}
                                            onClick={() => { onCopy?.('JSON'); setActiveDropdown(null); }}
                                        >
                                            As JSON
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
                                <button
                                    className={styles.outlineBtn}
                                    onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Download size={14} /> Export Selected ({selectedRowCount}) <ChevronDown size={12} />
                                </button>
                                {activeDropdown === 'export' && (
                                    <div className={styles.dropdownMenu} style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '4px',
                                        backgroundColor: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        zIndex: 100,
                                        width: '120px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <div
                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}
                                            className={styles.dropdownItem}
                                            onClick={() => { onExport?.('CSV'); setActiveDropdown(null); }}
                                        >
                                            As CSV
                                        </div>
                                        <div
                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}
                                            className={styles.dropdownItem}
                                            onClick={() => { onExport?.('JSON'); setActiveDropdown(null); }}
                                        >
                                            As JSON
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isSaved && onSaveChanges ? (
                        <button
                            className={styles.toolbarBtn}
                            onClick={onSaveChanges}
                            title="Save Changes"
                        >
                            <Save size={14} /> Save
                        </button>
                    ) : (
                        <>
                            {onSaveQuery && (
                                <button
                                    className={styles.toolbarBtn}
                                    onClick={onSaveQuery}
                                    title="Save Query"
                                >
                                    <Save size={14} /> Save Query
                                </button>
                            )}
                            {onSaveFunction && (
                                <button
                                    className={styles.toolbarBtn}
                                    onClick={onSaveFunction}
                                    title="Save Function"
                                >
                                    <FunctionSquare size={14} /> Save Function
                                </button>
                            )}
                        </>
                    )}
                    {onExportSql && (
                        <button
                            className={styles.toolbarBtn}
                            onClick={onExportSql}
                            title="Export as .sql"
                        >
                            <Download size={14} /> Export
                        </button>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    value={value}
                    theme={editorTheme}
                    beforeMount={handleBeforeMount}
                    onMount={handleEditorDidMount}
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        automaticLayout: true,
                        lineNumbers: 'on',
                        padding: { top: 10 },
                        glyphMargin: false,
                        codeLens: true
                    }}
                />
            </div>
        </div>
    );
};
