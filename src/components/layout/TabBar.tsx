
import React, { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    Modifier
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from '../../assets/icons';

import styles from '../../styles/MainLayout.module.css';
import { Tag, TableTag, TabItem } from '../../types/index';

// Tab Interface moved to types.ts

interface TabBarProps {
    tabs: TabItem[];
    activeTabId: string;
    onTabClick: (id: string) => void;
    onTabClose: (e: any, id: string) => void; // React.MouseEvent
    onTabDoubleClick: (id: string) => void;
    onDragEnd: (event: DragEndEvent) => void;
    tags: Tag[];
    tableTags: TableTag[];
}

const restrictToHorizontalAxis: Modifier = ({ transform }) => {
    return {
        ...transform,
        y: 0,
    };
};

const TabIcon = ({ tab, color }: { tab: TabItem; color?: string }) => {
    // Icons follow the theme-aware colors (white in dark, black in light)
    // Use passed color if available (e.g. from tag)
    const iconColor = color || 'var(--text-primary)';

    if (tab.type === 'query') return <Icons.Code2 size={14} style={{ flexShrink: 0, color: iconColor }} />;
    if (tab.type === 'function' || tab.type === 'function-output') return <Icons.MathFunction size={14} style={{ flexShrink: 0, color: iconColor }} />;
    if (tab.type === 'table') return <Icons.Table size={14} style={{ flexShrink: 0, color: iconColor }} />;
    if (tab.type === 'log') return <Icons.Activity size={14} style={{ flexShrink: 0, color: iconColor }} />;
    if (tab.type === 'create-table') return <Icons.Plus size={14} style={{ flexShrink: 0, color: iconColor }} />;
    if ((tab.type as string) === 'schema-diagram') return <Icons.Schema size={14} style={{ flexShrink: 0, color: iconColor }} />;
    return <Icons.Table size={14} style={{ flexShrink: 0, color: iconColor }} />;
};

function SortableTab({ tab, isActive, onClick, onClose, onDoubleClick, color }: { tab: TabItem, isActive: boolean, onClick: () => void, onClose: (e: any, id: string) => void, onDoubleClick?: () => void, color?: string }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
    const [isHovered, setIsHovered] = useState(false);
    const [isCloseHovered, setIsCloseHovered] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'pointer',
        padding: '0.5rem 1rem',
        backgroundColor: isActive ? 'var(--bg-secondary)' : (isHovered ? 'var(--bg-tertiary)' : 'var(--bg-primary)'),
        borderRight: '1px solid var(--border-color)',
        borderTop: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0,
        justifyContent: 'space-between',
        color: isActive ? 'var(--text-primary)' : (isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
        userSelect: 'none' as const,
        height: '100%'
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onMouseDown={(e) => {
                if (e.button === 1) {
                    e.preventDefault();
                }
                listeners?.onMouseDown?.(e);
            }}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onAuxClick={(e) => {
                // Middle-click (button 1) closes the tab
                if (e.button === 1) {
                    e.preventDefault();
                    onClose(e, tab.id);
                }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TabIcon tab={tab} color={color} />
                <span style={{
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    // overflow/textOverflow removed per UI polish
                    fontStyle: tab.isPreview ? 'italic' : 'normal'
                }}>{tab.title}</span>
            </div>
            <div
                role="button"
                onClick={(e) => onClose(e, tab.id)}
                onMouseEnter={() => setIsCloseHovered(true)}
                onMouseLeave={() => setIsCloseHovered(false)}
                style={{
                    opacity: isCloseHovered ? 1 : 0.6,
                    cursor: 'pointer',
                    display: 'flex',
                    flexShrink: 0,
                    marginLeft: '4px',
                    backgroundColor: isCloseHovered ? 'rgba(255, 77, 77, 0.2)' : 'transparent',
                    borderRadius: '4px',
                    padding: '2px',
                    color: isCloseHovered ? '#ff4d4d' : 'inherit'
                }}
            >
                <Icons.X size={12} />
            </div>
        </div>
    );
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onTabClick, onTabClose, onTabDoubleClick, onDragEnd, tags, tableTags }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    return (
        <div className={styles.tabBar}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToHorizontalAxis]}>
                <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                    <div className={styles.tabsContainer} style={{ display: 'flex', overflowX: 'auto' }} onWheel={(e) => {
                        if (e.deltaY !== 0) {
                            e.currentTarget.scrollLeft += e.deltaY;
                        }
                    }}>
                        {tabs.map(tab => {
                            let color: string | undefined;
                            if (tab.type === 'table') {
                                const tt = tableTags.find(t => t.table_name === tab.title);
                                const tag = tt ? tags.find(t => t.id === tt.tag_id) : undefined;
                                color = tag ? tag.color : 'var(--text-primary)';
                            }
                            return (
                                <SortableTab
                                    key={tab.id}
                                    tab={tab}
                                    isActive={activeTabId === tab.id}
                                    onClick={() => onTabClick(tab.id)}
                                    onClose={onTabClose}
                                    onDoubleClick={() => onTabDoubleClick(tab.id)}
                                    color={color}
                                />
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
};
