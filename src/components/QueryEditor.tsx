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
}

export const QueryEditor: React.FC<QueryEditorProps> = ({ value, onChange, onRunQuery, selectedRowCount = 0, onCopy, onExport }) => {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const providerRef = useRef<any>(null);

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

        // Register Command
        editor.addCommand(0, (_: any, ...args: any[]) => {
            const queryToRun = args[0];
            if (queryToRun) {
                onRunQuery(queryToRun);
            }
        }, '');

        // Register CodeLens Provider
        if (!providerRef.current) {
            providerRef.current = monaco.languages.registerCodeLensProvider('sql', {
                provideCodeLenses: function (model: any) {
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
                        // Find next non-whitespace after this semi-colon
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
                                id: 'cmd.runQuery',
                                title: '▶ Run',
                                arguments: [line]
                            }
                        })),
                        dispose: () => { }
                    };
                },
                resolveCodeLens: function (model: any, codeLens: any) {
                    return codeLens;
                }
            });

            // Register command that the lens triggers
            monaco.editor.addCommand({
                id: 'cmd.runQuery',
                run: (ctx: any, lineNumber: number) => {
                    const model = ctx.getModel();
                    const val = model.getValue();

                    // Find logic: extracts text bounded by semi-colons around the target line
                    const semiIndices = [...val.matchAll(/;/g)].map((m: any) => m.index!);

                    // Convert lineNumber to offset
                    const lineStartOff = model.getOffsetAt({ lineNumber: lineNumber, column: 1 });

                    // Find nearest preceding ; (or 0)
                    const start = semiIndices.filter((i: number) => i < lineStartOff).pop() ?? -1;

                    // Find nearest succeeding ; (or end)
                    let end = semiIndices.find((i: number) => i >= lineStartOff);
                    if (end === undefined) end = val.length;

                    const text = val.substring(start + 1, end).trim();
                    if (text) {
                        onRunQuery(text);
                    }
                }
            });
        }
    };

    // Cleanup provider on unmount
    useEffect(() => {
        return () => {
            if (providerRef.current) {
                providerRef.current.dispose();
            }
        };
    }, []);

    // Close dropdowns on outside click (simplified)
    useEffect(() => {
        const handleClick = () => setActiveDropdown(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Command handler logic (moved out of monaco init for state cleanliness if needed, 
    // but monaco commands are static. The `run` function captures closure if defined there.)
    // Note: `monaco.editor.addCommand` is global. This might crash if we add it twice.
    // Safe way: Check if command exists? Monaco doesn't expose `hasCommand`.
    // Exception swallowing or unique IDs (e.g. app instance ID) helps.
    // For this MVP, we risk valid console warning on re-register.

    // Better: Define the command behavior via `editor.addCommand` which is scoped to editor instance?
    // CodeLens `command` string must invoke a known command service ID. 
    // `editor.addCommand` adds it to that editor instance, but accessible via ID?
    // Try: use a specific ID `runQuery_${ uniqueId } `?
    // Let's stick to global `cmd.runQuery` and overwrite it safely or ignore error.

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
                        title="Run all queries"
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

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Ctrl+Enter to run selected
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    value={value}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        automaticLayout: true,
                        lineNumbers: 'on',
                        padding: { top: 10 },
                        glyphMargin: false,
                        // Enable code lens
                        codeLens: true
                    }}
                />
            </div>
        </div>
    );
};
