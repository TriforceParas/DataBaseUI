import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import styles from '../styles/MainLayout.module.css';
import { Play, ChevronDown, Copy, Download } from 'lucide-react';

interface QueryEditorProps {
    value: string;
    onChange: (value: string) => void;
    onRunQuery: (query: string) => void;
    // New props
    selectedRowCount?: number;
    onCopy?: (format: 'CSV' | 'JSON') => void;
    onExport?: (format: 'CSV' | 'JSON') => void;
    theme?: 'blue' | 'gray' | 'amoled' | 'light';
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

export const QueryEditor: React.FC<QueryEditorProps> = ({ value, onChange, onRunQuery, selectedRowCount = 0, onCopy, onExport, theme = 'blue' }) => {
    const editorTheme = theme === 'light' ? 'light' : 'vs-dark';
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const providerRef = useRef<any>(null);
    const commandRef = useRef<any>(null);

    // Unique command ID for this editor instance to avoid collisions and stale closures
    const commandId = useRef('cmd.runQuery.' + crypto.randomUUID()).current;

    // Dropdown state
    const [activeDropdown, setActiveDropdown] = useState<'copy' | 'export' | null>(null);

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
        // Note: We register this globally for 'sql', but we filter lenses or just provide them.
        // Since it's global registration, multiple editors might trigger this?
        // Actually `registerCodeLensProvider` is global for language.
        // It provides lenses for ALL models of that language.
        // We need to make sure we only provide lenses for THIS editor's model?
        // Or if we provide for all, we need to make sure the command ID is correct for THAT model.
        // Monaco calls provideCodeLenses(model).
        // We can check if `model === editor.getModel()`?
        // OR better: The provider itself should be global? NO.
        // If we register multiple providers for 'sql', they pile up.
        // ISSUE: `registerCodeLensProvider` IS GLOBAL.
        // If we have 3 tabs, we have 3 providers registered.
        // Each provider will get called for ANY sql model.
        // Provider A (Tab A) called for Model B (Tab B).
        // Provider A checks Model B. Generates lenses with Command A (Tab A).
        // User clicks lens in Tab B. Command A executes.
        // Command A uses `editor` (Tab A).
        // `editor.getModel()` is Model A. `onRunQuery` is Tab A's.
        // User clicked in Tab B, but Tab A runs?
        // AND query extracted from Model A?

        // CORRECTION:
        // We must ensure the provider ONLY returns lenses if the model matches THIS editor instance.

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
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => onRunQuery(value)}
                        title="Run all queries (Ctrl+Enter)"
                    >
                        <Play size={14} fill="currentColor" /> Run All
                    </button>

                    {selectedRowCount > 0 && (
                        <>
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
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    value={value}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme={editorTheme}
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
