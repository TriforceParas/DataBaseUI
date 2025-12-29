import {
    Activity,
    AlertCircle,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Code2,
    Copy,
    CornerDownLeft,
    Database,
    Download,
    Edit2,
    FileCode,
    FileText,
    Filter,
    Folder,
    FunctionSquare,
    GripVertical,
    HelpCircle,
    Home,
    Key,
    Layout,
    Link,
    ListPlus,
    Maximize2,
    Minimize2,
    Minus,
    MoreHorizontal,
    MoreVertical,
    MousePointer,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Play,
    Plus,
    RefreshCw,
    Save,
    Search,
    Settings,
    SidebarClose,
    SidebarOpen,
    Table,
    Terminal,
    Trash2,
    Upload,
    Workflow,
    X,
    ZoomIn,
    ZoomOut
} from 'lucide-react';

export const Icons = {
    Activity,
    AlertCircle,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Code2,
    Copy,
    CornerDownLeft,
    Database,
    Download,
    Edit2,
    FileCode,
    FileText,
    Filter,
    Folder,
    FunctionSquare,
    GripVertical,
    HelpCircle,
    Home,
    Key,
    Layout,
    Link,
    ListPlus,
    Maximize2,
    Minimize2,
    Minus,
    MoreHorizontal,
    MoreVertical,
    MousePointer,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Play,
    Plus,
    RefreshCw,
    Save,
    Search,
    Settings,
    SidebarClose,
    SidebarOpen,
    Table,
    Terminal,
    Trash2,
    Upload,
    Workflow,
    X,
    ZoomIn,
    ZoomOut,
    Schema: (props: any) => (
        <svg
            {...props}
            width={props.size || 24}
            height={props.size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="8" y="3" width="8" height="6" rx="1.5" />
            <path d="M12 9v4" />
            <path d="M6 13 h12" />
            <path d="M6 13v3" />
            <path d="M18 13v3" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
            <rect x="14" y="16" width="7" height="5" rx="1" />
        </svg>
    ),
    MathFunction: (props: any) => (
        <svg
            {...props}
            width={props.size || 24}
            height={props.size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15.5 2.5c-2 0-3.5 1-3.5 3.5v12c0 2.5-1.5 3.5-3.5 3.5" />
            <path d="M8.5 12h7" />
        </svg>
    )
};

export type IconName = keyof typeof Icons;
