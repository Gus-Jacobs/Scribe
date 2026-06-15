import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useFocused, useSlate, ReactEditor } from 'slate-react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  TableCellsMerge,
  TableCellsSplit,
  PaintBucket,
  Rows3,
  Columns3,
} from 'lucide-react';
import {
  canMergeRight,
  canSplit,
  deleteColumn,
  deleteRow,
  getActiveTable,
  insertColumn,
  insertRow,
  mergeCellRight,
  setCellBackground,
  splitCell,
} from './tableCommands';

/**
 * Floating table controls: appears above the table whenever the selection is
 * inside one. Row/column insertion, deletion, cell merging, and shading.
 */

const SHADES = ['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#f3f4f6'];

const Button = ({
  label,
  disabled,
  onAction,
  children,
}: {
  label: string;
  disabled?: boolean;
  onAction: () => void;
  children: React.ReactNode;
}) => (
  <button
    title={label}
    aria-label={label}
    disabled={disabled}
    className={`p-1.5 rounded ${
      disabled ? 'opacity-30 cursor-default' : 'hover:bg-white/15'
    } text-gray-100 transition-colors`}
    onMouseDown={event => {
      event.preventDefault();
      if (!disabled) onAction();
    }}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-white/20 mx-1" />;

const TableToolbar = () => {
  const editor = useSlate();
  const inFocus = useFocused();
  const ref = useRef<HTMLDivElement>(null);
  const [shadeOpen, setShadeOpen] = useState(false);

  const table = getActiveTable(editor);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!table || !inFocus) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      if (shadeOpen) setShadeOpen(false);
      return;
    }

    try {
      const dom = ReactEditor.toDOMNode(editor, table[0]);
      const rect = dom.getBoundingClientRect();
      const top = rect.top - el.offsetHeight - 6;
      const left = Math.max(
        8,
        Math.min(
          rect.left + rect.width / 2 - el.offsetWidth / 2,
          window.innerWidth - el.offsetWidth - 8
        )
      );
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.style.top = `${Math.max(8, top)}px`;
      el.style.left = `${left}px`;
    } catch {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }
  });

  return ReactDOM.createPortal(
    <div
      ref={ref}
      className="fixed z-40 flex items-center px-1.5 py-1 rounded-lg bg-gray-900/95 shadow-xl border border-white/10 backdrop-blur transition-opacity duration-100"
      style={{ opacity: 0, pointerEvents: 'none', top: -9999, left: -9999 }}
      onMouseDown={event => event.preventDefault()}
    >
      <span className="flex items-center text-gray-400 mr-1" title="Rows">
        <Rows3 size={14} />
      </span>
      <Button label="Insert row above" onAction={() => insertRow(editor, 'above')}>
        <ArrowUpToLine size={15} />
      </Button>
      <Button label="Insert row below" onAction={() => insertRow(editor, 'below')}>
        <ArrowDownToLine size={15} />
      </Button>
      <Button label="Delete row" onAction={() => deleteRow(editor)}>
        <Trash2 size={15} />
      </Button>
      <Divider />
      <span className="flex items-center text-gray-400 mr-1" title="Columns">
        <Columns3 size={14} />
      </span>
      <Button label="Insert column left" onAction={() => insertColumn(editor, 'left')}>
        <ArrowLeftToLine size={15} />
      </Button>
      <Button label="Insert column right" onAction={() => insertColumn(editor, 'right')}>
        <ArrowRightToLine size={15} />
      </Button>
      <Button label="Delete column" onAction={() => deleteColumn(editor)}>
        <Trash2 size={15} />
      </Button>
      <Divider />
      <Button
        label="Merge cell right"
        disabled={!canMergeRight(editor)}
        onAction={() => mergeCellRight(editor)}
      >
        <TableCellsMerge size={15} />
      </Button>
      <Button label="Split merged cell" disabled={!canSplit(editor)} onAction={() => splitCell(editor)}>
        <TableCellsSplit size={15} />
      </Button>
      <div className="relative">
        <Button label="Cell shading" onAction={() => setShadeOpen(open => !open)}>
          <PaintBucket size={15} />
        </Button>
        {shadeOpen && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center space-x-1 p-1.5 rounded-lg bg-gray-900/95 border border-white/10 shadow-xl">
            {SHADES.map(color => (
              <button
                key={color}
                aria-label={`Shade ${color}`}
                className="w-4 h-4 rounded border border-white/30 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onMouseDown={event => {
                  event.preventDefault();
                  setCellBackground(editor, color);
                  setShadeOpen(false);
                }}
              />
            ))}
            <button
              aria-label="Clear shading"
              className="w-4 h-4 rounded border border-white/30 bg-transparent text-[8px] text-white"
              onMouseDown={event => {
                event.preventDefault();
                setCellBackground(editor, null);
                setShadeOpen(false);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default TableToolbar;
