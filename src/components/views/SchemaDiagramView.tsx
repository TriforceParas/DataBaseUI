import React, { useRef } from 'react';
import { SchemaVisualizer } from '../editors';
import { ColumnSchema } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { captureSchemaScreenshot } from '../../helpers/screenshotHelper';

interface SchemaDiagramViewProps {
    tables: string[];
    tableSchemas: Record<string, ColumnSchema[]>;
    onTableClick: (tableName: string) => void;
    theme: 'blue' | 'gray' | 'amoled' | 'light';
    setIsCapturing: (capturing: boolean) => void;
    addToast: (title: string, message: string, filePath?: string, type?: 'success' | 'error' | 'info') => void;
}

export const SchemaDiagramView: React.FC<SchemaDiagramViewProps> = ({
    tables,
    tableSchemas,
    onTableClick,
    theme,
    setIsCapturing,
    addToast
}) => {
    const schemaContainerRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        if (schemaContainerRef.current) {
            setIsCapturing(true);

            invoke('open_loading_window').catch(console.error);

            setTimeout(() => {
                captureSchemaScreenshot(
                    schemaContainerRef.current!,
                    (filePath) => {
                        invoke('close_loading_window').catch(console.error);
                        setIsCapturing(false);
                        addToast('Screenshot Saved', 'Click to open', filePath, 'success');
                    },
                    (error) => {
                        invoke('close_loading_window').catch(console.error);
                        setIsCapturing(false);
                        addToast('Screenshot Failed', error, undefined, 'error');
                    }
                );
            }, 500);
        }
    };

    return (
        <div ref={schemaContainerRef} style={{ height: '100%', width: '100%' }}>
            <SchemaVisualizer
                tables={tables}
                tableSchemas={tableSchemas}
                onTableClick={onTableClick}
                theme={theme}
                onDownload={handleDownload}
            />
        </div>
    );
};
