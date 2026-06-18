import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Editor, Range } from 'slate';
import { useFocused, useSlate } from 'slate-react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link2,
  Heading1,
  Heading2,
  TextQuote,
  Highlighter,
  RemoveFormatting,
} from 'lucide-react';
import { MarkFormat } from '../CustomTypes';
import {
  isBlockActive,
  isLinkActive,
  isMarkActive,
  insertLink,
  toggleBlock,
  toggleMark,
  unwrapLink,
} from './formatting';

/**
 * Notion/Medium-style contextual toolbar: appears above the current text
 * selection for rapid formatting without reaching for the ribbon.
 */

const ToolbarButton = ({
  active,
  label,
  onAction,
  children,
}: {
  active?: boolean;
  label: string;
  onAction: () => void;
  children: React.ReactNode;
}) => (
  <button
    title={label}
    aria-label={label}
    className={`p-1.5 rounded transition-colors ${
      active ? 'bg-blue-500/40 text-blue-200' : 'hover:bg-white/15 text-gray-100'
    }`}
    onMouseDown={event => {
      event.preventDefault();
      onAction();
    }}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-white/20 mx-1" />;

const FloatingToolbar = () => {
  const editor = useSlate();
  const inFocus = useFocused();
  const ref = useRef<HTMLDivElement>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (trimmed) {
      const href = /^[a-z][a-z0-9+.-]*:|^#|^\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      insertLink(editor, href, linkText.trim());
    }
    setLinkOpen(false);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // While editing a link, keep the toolbar parked where it is — the inputs
    // steal DOM focus (collapsing the selection) and we must not hide it.
    if (linkOpen) return;

    const { selection } = editor;
    const domSelection = window.getSelection();

    const shouldHide =
      !selection ||
      !inFocus ||
      Range.isCollapsed(selection) ||
      Editor.string(editor, selection) === '' ||
      !domSelection ||
      domSelection.rangeCount === 0;

    if (shouldHide) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      if (highlightOpen) setHighlightOpen(false);
      return;
    }

    const rect = domSelection.getRangeAt(0).getBoundingClientRect();
    const top = rect.top - el.offsetHeight - 8;
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
  });

  const markButton = (format: MarkFormat, label: string, icon: React.ReactNode) => (
    <ToolbarButton
      active={isMarkActive(editor, format)}
      label={label}
      onAction={() => toggleMark(editor, format)}
    >
      {icon}
    </ToolbarButton>
  );

  const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#ddd6fe'];

  return ReactDOM.createPortal(
    <div
      ref={ref}
      className="fixed z-50 flex items-center px-1.5 py-1 rounded-lg bg-gray-900/95 shadow-xl border border-white/10 backdrop-blur transition-opacity duration-100"
      style={{ opacity: 0, pointerEvents: 'none', top: -9999, left: -9999 }}
      onMouseDown={event => event.preventDefault()}
    >
      {markButton('bold', 'Bold', <Bold size={15} />)}
      {markButton('italic', 'Italic', <Italic size={15} />)}
      {markButton('underline', 'Underline', <Underline size={15} />)}
      {markButton('strikethrough', 'Strikethrough', <Strikethrough size={15} />)}
      {markButton('code', 'Code', <Code size={15} />)}
      <Divider />
      <ToolbarButton
        active={isBlockActive(editor, 'heading-one')}
        label="Heading 1"
        onAction={() => toggleBlock(editor, 'heading-one')}
      >
        <Heading1 size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={isBlockActive(editor, 'heading-two')}
        label="Heading 2"
        onAction={() => toggleBlock(editor, 'heading-two')}
      >
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={isBlockActive(editor, 'block-quote')}
        label="Quote"
        onAction={() => toggleBlock(editor, 'block-quote')}
      >
        <TextQuote size={15} />
      </ToolbarButton>
      <Divider />
      <div className="relative">
        <ToolbarButton
          active={linkOpen || isLinkActive(editor)}
          label="Link"
          onAction={() => {
            if (isLinkActive(editor)) {
              unwrapLink(editor);
              return;
            }
            const sel = editor.selection;
            setLinkText(sel && !Range.isCollapsed(sel) ? Editor.string(editor, sel) : '');
            setLinkUrl('');
            setLinkOpen(open => !open);
          }}
        >
          <Link2 size={15} />
        </ToolbarButton>
        {linkOpen && (
          <div
            className="absolute top-8 left-0 z-50 flex flex-col space-y-1 p-2 rounded-lg bg-gray-900/95 border border-white/10 shadow-xl w-56"
            // stopPropagation so the toolbar's mousedown-preventDefault does not
            // block these inputs from receiving focus.
            onMouseDown={event => event.stopPropagation()}
          >
            <input
              autoFocus
              value={linkUrl}
              placeholder="https://example.com"
              onChange={event => setLinkUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); applyLink(); }
                if (event.key === 'Escape') setLinkOpen(false);
              }}
              className="px-2 py-1 text-sm rounded bg-gray-800 text-gray-100 border border-white/10 outline-none placeholder-gray-500"
            />
            <input
              value={linkText}
              placeholder="Display text (optional)"
              onChange={event => setLinkText(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); applyLink(); }
                if (event.key === 'Escape') setLinkOpen(false);
              }}
              className="px-2 py-1 text-sm rounded bg-gray-800 text-gray-100 border border-white/10 outline-none placeholder-gray-500"
            />
            <div className="flex justify-end space-x-1">
              <button
                onMouseDown={event => { event.preventDefault(); setLinkOpen(false); }}
                className="px-2 py-1 text-xs rounded text-gray-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onMouseDown={event => { event.preventDefault(); applyLink(); }}
                className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <ToolbarButton
          active={highlightOpen || isMarkActive(editor, 'backgroundColor')}
          label="Highlight"
          onAction={() => setHighlightOpen(open => !open)}
        >
          <Highlighter size={15} />
        </ToolbarButton>
        {highlightOpen && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center space-x-1 p-1.5 rounded-lg bg-gray-900/95 border border-white/10 shadow-xl">
            {HIGHLIGHTS.map(color => (
              <button
                key={color}
                aria-label={`Highlight ${color}`}
                className="w-4 h-4 rounded-full border border-white/30 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onMouseDown={event => {
                  event.preventDefault();
                  Editor.addMark(editor, 'backgroundColor', color);
                  setHighlightOpen(false);
                }}
              />
            ))}
            <button
              aria-label="Remove highlight"
              className="w-4 h-4 rounded-full border border-white/30 bg-transparent text-[8px] text-white"
              onMouseDown={event => {
                event.preventDefault();
                Editor.removeMark(editor, 'backgroundColor');
                setHighlightOpen(false);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <ToolbarButton
        label="Clear formatting"
        onAction={() => {
          const marks = Editor.marks(editor);
          if (marks) {
            Object.keys(marks).forEach(key => Editor.removeMark(editor, key));
          }
        }}
      >
        <RemoveFormatting size={15} />
      </ToolbarButton>
    </div>,
    document.body
  );
};

export default FloatingToolbar;
