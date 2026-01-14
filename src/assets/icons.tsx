import {
    PiPulse,
    PiFunctionBold
} from 'react-icons/pi';
import {
    TbLayoutSidebarLeftExpand,
    TbLayoutSidebarLeftCollapse
} from 'react-icons/tb';
import {
    IoSearchOutline
} from 'react-icons/io5';
import {
    CiViewTable
} from 'react-icons/ci';
import {
    LuRefreshCcw
} from 'react-icons/lu';
import {
    RiAlertLine,
    RiErrorWarningLine,
    RiCheckLine,
    RiArrowDownSLine,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiArrowUpSLine,
    RiFileCopyLine,
    RiCornerDownLeftLine,
    RiDatabase2Line,
    RiDownloadLine,
    RiEdit2Line,
    RiFileCodeLine,
    RiFileTextLine,
    RiFilterLine,
    RiFunctions,
    RiDragMove2Line,
    RiQuestionLine,
    RiHomeLine,
    RiKey2Line,
    RiLayoutMasonryLine,
    RiLink,
    RiListCheck2,
    RiFullscreenLine,
    RiFullscreenExitLine,
    RiSubtractLine,
    RiMoreFill,
    RiMore2Fill,
    RiCursorLine,
    RiPencilLine,
    RiPlayLine,
    RiAddLine,
    RiSaveLine,
    RiSettings3Line,
    RiTerminalBoxLine,
    RiDeleteBinLine,
    RiUploadLine,
    RiGitMergeLine,
    RiCloseLine,
    RiZoomInLine,
    RiZoomOutLine
} from 'react-icons/ri';
import { FaCode, FaRegFolder } from 'react-icons/fa';

export const Icons = {
    Activity: PiPulse,
    AlertCircle: RiAlertLine,
    AlertTriangle: RiErrorWarningLine,
    Check: RiCheckLine,
    ChevronDown: RiArrowDownSLine,
    ChevronLeft: RiArrowLeftSLine,
    ChevronRight: RiArrowRightSLine,
    ChevronUp: RiArrowUpSLine,
    Code2: FaCode,
    Copy: RiFileCopyLine,
    CornerDownLeft: RiCornerDownLeftLine,
    Database: RiDatabase2Line,
    Download: RiDownloadLine,
    Edit2: RiEdit2Line,
    FileCode: RiFileCodeLine,
    FileText: RiFileTextLine,
    Filter: RiFilterLine,
    Folder: FaRegFolder,
    FunctionSquare: RiFunctions,
    GripVertical: RiDragMove2Line,
    HelpCircle: RiQuestionLine,
    Home: RiHomeLine,
    Key: RiKey2Line,
    Layout: RiLayoutMasonryLine,
    Link: RiLink,
    ListPlus: RiListCheck2,
    Maximize2: RiFullscreenLine,
    Minimize2: RiFullscreenExitLine,
    Minus: RiSubtractLine,
    MoreHorizontal: RiMoreFill,
    MoreVertical: RiMore2Fill,
    MousePointer: RiCursorLine,
    PanelLeftClose: TbLayoutSidebarLeftCollapse,
    PanelLeftOpen: TbLayoutSidebarLeftExpand,
    Pencil: RiPencilLine,
    Play: RiPlayLine,
    Plus: RiAddLine,
    RefreshCw: LuRefreshCcw,
    Save: RiSaveLine,
    Search: IoSearchOutline,
    Settings: RiSettings3Line,
    SidebarClose: TbLayoutSidebarLeftCollapse,
    SidebarOpen: TbLayoutSidebarLeftExpand,
    Table: CiViewTable,
    Terminal: RiTerminalBoxLine,
    Trash2: RiDeleteBinLine,
    Upload: RiUploadLine,
    Workflow: RiGitMergeLine,
    X: RiCloseLine,
    ZoomIn: RiZoomInLine,
    ZoomOut: RiZoomOutLine,
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
    MathFunction: PiFunctionBold
};

export type IconName = keyof typeof Icons;
