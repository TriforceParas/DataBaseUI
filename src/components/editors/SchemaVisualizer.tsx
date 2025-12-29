import React, { useMemo, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    ControlButton,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    Handle,
    Position,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ColumnSchema } from '../../types/index';

// ... (imports remain)
import { Key, Link, Table, ChevronDown, ChevronUp, Download } from 'lucide-react';

// Dagre layout helper
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 260;
    const nodeHeight = 180;

    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 80,
        ranksep: 120,
        marginx: 50,
        marginy: 50
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

interface SchemaVisualizerProps {
    tables: string[];
    tableSchemas: Record<string, ColumnSchema[]>;
    onTableClick?: (tableName: string) => void;
    onDownload?: () => void;
    theme?: string;
}

// Helper to categorize columns - collapsed by default (shows only PKs and FKs)
const categorizeColumns = (columns: ColumnSchema[], expanded: boolean) => {
    const pks: ColumnSchema[] = [];
    const fks: ColumnSchema[] = [];
    const others: ColumnSchema[] = [];

    columns.forEach(col => {
        const isPK = col.is_primary_key;
        // Heuristic for FKs since backend doesn't support it yet
        const isFK = (col.name.endsWith('_id') && col.name !== 'id');

        if (isPK) pks.push(col);
        else if (isFK) fks.push(col);
        else others.push(col);
    });

    return {
        visibleColumns: expanded ? [...pks, ...fks, ...others] : [...pks, ...fks],
        hiddenCount: expanded ? 0 : others.length
    };
};


// ... 

// Logic inside calculateNodesAndEdges needs update too
// I'll handle that via separate chunks or confirm if I can do it here. 
// The chunk above covers restoring the function and interface. 
// I need another chunk for the logic inside calculateNodesAndEdges.

const TableHandles = ({ columns }: { columns: ColumnSchema[] }) => {
    return (
        <>
            {columns.map((col, idx) => {
                const isPK = col.is_primary_key;
                // Heuristic for FKs
                const isFK = (col.name.endsWith('_id') && col.name !== 'id');
                const topOffset = 44 + (idx * 28) + (28 / 2);

                return (
                    <React.Fragment key={`handles-${col.name}`}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={`${col.name}-target`}
                            style={{
                                top: topOffset,
                                left: -5,
                                background: isPK ? '#eab308' : '#64748b',
                                width: 8,
                                height: 8,
                                border: '1px solid var(--bg-secondary)',
                                opacity: isPK ? 1 : 0.3
                            }}
                        />
                        {isFK && col.name !== 'id' && (
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`${col.name}-source`}
                                style={{
                                    top: topOffset,
                                    right: -5,
                                    background: '#3b82f6',
                                    width: 8,
                                    height: 8,
                                    border: '1px solid var(--bg-secondary)'
                                }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};

const ColumnRow = ({ col, isLast }: { col: ColumnSchema, isLast: boolean }) => {
    const isPK = col.is_primary_key;
    // Heuristic for FKs
    const isFK = (col.name.endsWith('_id') && col.name !== 'id');

    return (
        <div
            style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                borderBottom: !isLast ? '1px solid var(--border-color)' : 'none',
                background: isPK ? 'rgba(234, 179, 8, 0.15)' : isFK ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                height: '28px',
                boxSizing: 'border-box'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {isPK && <Key size={11} style={{ color: '#eab308' }} />}
                {isFK && <Link size={11} style={{ color: '#3b82f6' }} />}
                <span style={{ color: 'var(--text-primary)', fontWeight: isPK ? 600 : 400 }}>
                    {col.name}
                </span>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                {col.type_name}
            </span>
        </div>
    );
};

const TableHeader = ({ label, onClick }: { label: string; onClick?: (name: string) => void }) => (
    <div
        style={{
            background: 'var(--accent-primary)',
            color: 'var(--bg-primary)',
            padding: '0.6rem 0.75rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: '8px 8px 0 0',
            justifyContent: 'space-between',
            height: '44px',
            boxSizing: 'border-box'
        }}
        onClick={() => onClick?.(label)}
        title="Click to open table data"
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Table size={14} style={{ opacity: 0.8 }} />
            {label}
        </div>
    </div>
);

const ToggleRow = ({ hasHiddenCount, expanded, onToggle }: { hasHiddenCount: number, expanded: boolean, onToggle: () => void }) => (
    <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.3rem',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '0.7rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)'
        }}
    >
        {expanded ? (
            <>
                <ChevronUp size={12} style={{ marginRight: 4 }} /> Show Less
            </>
        ) : (
            <>
                <ChevronDown size={12} style={{ marginRight: 4 }} /> {hasHiddenCount} More Columns
            </>
        )}
    </div>
);

// Main TableNode Component
const TableNode = ({ data }: { data: { label: string; columns: ColumnSchema[]; onTableClick?: (name: string) => void } }) => {
    const { label, columns, onTableClick } = data;
    const [expanded, setExpanded] = useState(false);

    const { visibleColumns, hiddenCount } = useMemo(() => categorizeColumns(columns, expanded), [columns, expanded]);

    return (
        <div
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                minWidth: '220px',
                maxWidth: '280px',
                overflow: 'visible',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                position: 'relative'
            }}
        >
            <TableHandles columns={visibleColumns} />
            <TableHeader label={label} onClick={onTableClick} />

            <div style={{ overflowY: 'visible', overflowX: 'hidden' }}>
                {visibleColumns.map((col, idx) => (
                    <ColumnRow key={col.name} col={col} isLast={idx === visibleColumns.length - 1 && hiddenCount === 0} />
                ))}

                {(hiddenCount > 0 || expanded) && (
                    <ToggleRow
                        hasHiddenCount={hiddenCount}
                        expanded={expanded}
                        onToggle={() => setExpanded(!expanded)}
                    />
                )}
            </div>
        </div>
    );
};

const nodeTypes = { tableNode: TableNode };

// Helper to generate graph elements
const calculateNodesAndEdges = (tables: string[], tableSchemas: Record<string, ColumnSchema[]>, onTableClick?: (name: string) => void) => {
    // Create raw nodes (positions will be set by dagre)
    const rawNodes: Node[] = tables.map((tableName) => ({
        id: tableName,
        type: 'tableNode',
        position: { x: 0, y: 0 },
        data: {
            label: tableName,
            columns: tableSchemas[tableName] || [],
            onTableClick
        }
    }));

    // Create edges based on FK relationships
    const rawEdges: Edge[] = [];

    tables.forEach(tableName => {
        const schema = tableSchemas[tableName] || [];
        schema.forEach(col => {
            // Heuristic: column ending with _id might be a FK
            if (col.name.endsWith('_id') && col.name !== 'id') {
                const referencedTable = col.name.replace('_id', '');
                const matchedTable = tables.find(t =>
                    t.toLowerCase() === referencedTable.toLowerCase() ||
                    t.toLowerCase() === referencedTable.toLowerCase() + 's' ||
                    t.toLowerCase() + 's' === referencedTable.toLowerCase()
                );

                // Prevent self-reference if this is just the PK naming convention
                if (matchedTable === tableName && col.is_primary_key) {
                    return;
                }

                if (matchedTable) {
                    const targetSchema = tableSchemas[matchedTable] || [];
                    const singularName = matchedTable.toLowerCase().endsWith('s') ? matchedTable.slice(0, -1) : matchedTable;

                    const pkColumn =
                        targetSchema.find(c => c.is_primary_key) ||
                        targetSchema.find(c => c.name.toLowerCase() === 'id') ||
                        targetSchema.find(c => c.name.toLowerCase() === `${matchedTable}_id`.toLowerCase()) ||
                        targetSchema.find(c => c.name.toLowerCase() === `${singularName}_id`.toLowerCase());

                    if (pkColumn) {
                        rawEdges.push({
                            id: `${tableName}-${col.name}-${matchedTable}`,
                            source: tableName,
                            sourceHandle: `${col.name}-source`,
                            target: matchedTable,
                            targetHandle: `${pkColumn.name}-target`,
                            type: 'smoothstep',
                            animated: true,
                            style: { stroke: '#3b82f6', strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                        });
                    }
                }
            }
        });
    });

    // Apply dagre layout
    const { nodes: lNodes, edges: lEdges } = getLayoutedElements(rawNodes, rawEdges, 'LR');
    return { layoutedNodes: lNodes, layoutedEdges: lEdges };
};

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
    tables,
    tableSchemas,
    onTableClick,
    onDownload
}) => {

    // Generate raw nodes and edges first, then apply layout
    const { layoutedNodes, layoutedEdges } = useMemo(
        () => calculateNodesAndEdges(tables, tableSchemas, onTableClick),
        [tables, tableSchemas, onTableClick]
    );

    const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
    const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

    // Dynamic styles
    const controlsStyle = {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        padding: '2px', // Slight padding for the inner buttons
        display: 'flex',
        flexDirection: 'column' as const
    };

    return (
        <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>
            <style>{`
                .react-flow__controls button {
                    background: transparent !important;
                    border: none !important;
                    color: var(--text-primary) !important;
                    margin: 0 !important;
                    width: 32px !important;
                    height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .react-flow__controls button:hover {
                    background: var(--bg-tertiary) !important;
                    border-radius: 4px !important;
                }
                .react-flow__controls button svg {
                    fill: var(--text-primary) !important;
                    width: 14px !important;
                    height: 14px !important;
                }
            `}</style>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
            >
                <Background color="var(--border-color)" gap={20} />
                <Controls style={controlsStyle}>
                    {onDownload && (
                        <ControlButton onClick={onDownload} title="Save Image">
                            <Download />
                        </ControlButton>
                    )}
                </Controls>
            </ReactFlow>

            {/* Legend - positioned top right */}
            <div
                data-legend="true"
                style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.7rem',
                    display: 'flex',
                    gap: '1rem',
                    zIndex: 10
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Key size={11} style={{ color: '#eab308' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Primary Key</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Link size={11} style={{ color: '#3b82f6' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Foreign Key</span>
                </div>
            </div>
        </div>
    );
};
