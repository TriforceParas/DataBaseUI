import React, { useMemo, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
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
import { Key, Link, Table, ChevronDown, ChevronUp } from 'lucide-react';

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

interface ColumnSchema {
    name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    column_key: string;
}

interface SchemaVisualizerProps {
    tables: string[];
    tableSchemas: Record<string, ColumnSchema[]>;
    onTableClick?: (tableName: string) => void;
    theme?: 'blue' | 'gray' | 'amoled' | 'light';
}

// Custom node component for table cards with handles for each column
const TableNode = ({ data }: { data: { label: string; columns: ColumnSchema[]; onTableClick?: (name: string) => void } }) => {
    const { label, columns, onTableClick } = data;
    const [expanded, setExpanded] = useState(false);

    // Sort and filter columns
    const { visibleColumns, hasHiddenCount } = useMemo(() => {
        const pks: ColumnSchema[] = [];
        const fks: ColumnSchema[] = [];
        const others: ColumnSchema[] = [];

        columns.forEach(col => {
            const isPK = col.column_key === 'PRI';
            const isFK = col.column_key === 'MUL' || col.column_key === 'FK' || (col.name.endsWith('_id') && col.name !== 'id');

            if (isPK) pks.push(col);
            else if (isFK) fks.push(col);
            else others.push(col);
        });

        // "others" are only visible if expanded
        const visibleOthers = expanded ? others : [];
        const hiddenCount = others.length;

        return {
            visibleColumns: [...pks, ...fks, ...visibleOthers],
            hasHiddenCount: !expanded ? hiddenCount : 0
        };
    }, [columns, expanded]);

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
            {/* Handles rendered at node level (outside scrollable area) */}
            {visibleColumns.map((col, idx) => {
                const isPK = col.column_key === 'PRI';
                const isFK = col.column_key === 'MUL' || col.column_key === 'FK' || (col.name.endsWith('_id') && col.name !== 'id');
                // Calculate vertical position: header (44px) + column index * row height (28px) + row center offset
                const headerHeight = 44;
                const rowHeight = 28;
                const topOffset = headerHeight + (idx * rowHeight) + (rowHeight / 2);

                return (
                    <React.Fragment key={`handles-${col.name}`}>
                        {/* Left Handle (Target) */}
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
                        {/* Right Handle (Source) */}
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

            {/* Table Header */}
            <div
                style={{
                    background: 'var(--accent-color)',
                    color: 'white',
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
                onClick={() => onTableClick?.(label)}
                title="Click to open table data"
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Table size={14} style={{ opacity: 0.8 }} />
                    {label}
                </div>
            </div>

            {/* Columns (scrollable content) */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'hidden' }}>
                {visibleColumns.map((col, idx) => {
                    const isPK = col.column_key === 'PRI';
                    const isFK = col.column_key === 'MUL' || col.column_key === 'FK' || (col.name.endsWith('_id') && col.name !== 'id');

                    return (
                        <div
                            key={col.name}
                            style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                borderBottom: idx < visibleColumns.length - 1 ? '1px solid var(--border-color)' : 'none',
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
                                {col.data_type}
                            </span>
                        </div>
                    );
                })}

                {/* Expand/Collapse Toggle */}
                {(hasHiddenCount > 0 || expanded) && (
                    <div
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
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
                )}
            </div>
        </div>
    );
};

const nodeTypes = { tableNode: TableNode };

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
    tables,
    tableSchemas,
    onTableClick,
    theme = 'blue'
}) => {
    const isDark = theme !== 'light';

    // Generate raw nodes and edges first, then apply layout
    const { layoutedNodes, layoutedEdges } = useMemo(() => {
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
                    if (matchedTable === tableName && col.column_key === 'PRI') {
                        return;
                    }

                    if (matchedTable) {
                        const targetSchema = tableSchemas[matchedTable] || [];
                        const singularName = matchedTable.toLowerCase().endsWith('s') ? matchedTable.slice(0, -1) : matchedTable;

                        const pkColumn =
                            targetSchema.find(c => c.column_key === 'PRI') ||
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
    }, [tables, tableSchemas, onTableClick]);

    const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
    const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

    // Dynamic styles
    const controlsStyle = {
        background: isDark ? '#1e1e1e' : '#ffffff',
        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    };

    return (
        <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>
            <style>{`
                .react-flow__controls button {
                    background: ${isDark ? '#2a2a2a' : '#f5f5f5'} !important;
                    border: 1px solid ${isDark ? '#444' : '#ddd'} !important;
                    border-radius: 4px !important;
                    color: ${isDark ? '#fff' : '#333'} !important;
                    margin: 2px !important;
                }
                .react-flow__controls button:hover {
                    background: ${isDark ? '#3a3a3a' : '#e5e5e5'} !important;
                }
                .react-flow__controls button svg {
                    fill: ${isDark ? '#fff' : '#333'} !important;
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
                <Background color={isDark ? '#333' : '#ddd'} gap={20} />
                <Controls style={controlsStyle} />
            </ReactFlow>

            {/* Legend - positioned top right */}
            <div style={{
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
