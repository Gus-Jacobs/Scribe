import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement, Range, Text, Node } from 'slate';
import { Slate, Editable, withReact, useSlate, useSlateStatic, useSelected, useFocused, ReactEditor } from 'slate-react';
import ErrorBoundary from './ErrorBoundary';
import { withHistory, HistoryEditor } from 'slate-history';
import isUrl from 'is-url';
import { v4 as uuidv4 } from 'uuid';
import { Resizable } from 're-resizable';
import { Plus, Trash, Columns, Rows, List } from 'lucide-react';

import { CustomElement, CustomText, MarkFormat, TableCellElement } from './CustomTypes';
import FloatingToolbar from './editor/FloatingToolbar';
import TableToolbar from './editor/TableToolbar';
import {
    toggleMark, isMarkActive, addMarkData, toggleBlock, isBlockActive,
    isLinkActive, unwrapLink, wrapLink, insertLink, LIST_TYPES, TEXT_ALIGN_TYPES,
} from './editor/formatting';
import {
    insertRow as insertTableRow, deleteRow as deleteTableRow,
    insertColumn as insertTableColumn, deleteColumn as deleteTableColumn,
} from './editor/tableCommands';
import {
    BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, CodeIcon, LinkIcon, QuoteIcon, H1Icon, H2Icon, H3Icon,
    NumberedListIcon, BulletedListIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, AlignJustifyIcon,
    IndentIcon, OutdentIcon, ImageIcon, HorizontalRuleIcon, SaveIcon, OpenIcon, UndoIcon, RedoIcon,
    SuperscriptIcon, SubscriptIcon, TableIcon, TocIcon, FootnoteIcon, CitationIcon, ShapesIcon, FindIcon,
    NewIcon, SaveAsIcon, PrintIcon, ExportIcon, CloseIcon, ShareIcon, InfoIcon, ClearFormattingIcon,
    IncreaseFontSizeIcon, DecreaseFontSizeIcon, CutIcon, CopyIcon, PasteIcon, SettingsIcon, TemplateIcon,
    SymbolIcon, ContactIcon, UpdateIcon, DonateIcon, iconList
} from './icons';

// Unicode glyphs inserted as REAL text — unlike the Lucide SVG icons, these
// export natively into Word/PDF/ODT and stay searchable/selectable.
const SYMBOL_GROUPS: Record<string, string[]> = {
    Common: ['™', '®', '©', '℠', '°', '§', '¶', '†', '‡', '•', '·', '…', '–', '—', '★', '☆', '✓', '✔', '✗', '✘', '☑', '☐'],
    Math: ['×', '÷', '±', '∓', '≈', '≠', '≡', '≤', '≥', '∞', '√', '∑', '∏', '∫', '∂', '∆', '∇', 'π', 'µ', 'Ω', '∈', '∉', '⊂', '⊃', '∪', '∩', '∀', '∃', '∝', '∴', '′', '″', '½', '¼', '¾'],
    Arrows: ['←', '→', '↑', '↓', '↔', '↕', '⇐', '⇒', '⇔', '⇄', '↩', '↪', '⤴', '⤵', '➜', '➤', '»', '«'],
    Currency: ['$', '€', '£', '¥', '¢', '₹', '₽', '₩', '₿', '₪', '₱', '¤'],
    Greek: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'τ', 'φ', 'χ', 'ψ', 'ω', 'Γ', 'Δ', 'Θ', 'Λ', 'Π', 'Σ', 'Φ', 'Ψ', 'Ω'],
    Emoji: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '😉', '😊', '😍', '😎', '🤔', '😴', '👍', '👎', '👏', '🙏', '💪', '🔥', '⭐', '❤️', '💡', '📌', '📎', '✅', '❌', '⚠️', '📈', '📉', '🎯', '🚀'],
};

// --- Constants ---
const FONT_FACES = ['Arial', 'Baskerville', 'Courier New', 'Futura', 'Garamond', 'Georgia', 'Gill Sans', 'Helvetica', 'Palatino', 'Times New Roman', 'Verdana', 'American Typewriter', 'Andale Mono', 'Apple Chancery', 'Bradley Hand', 'Brush Script MT', 'Comic Sans MS', 'Didot', 'Herculanum', 'Impact', 'Jazz LET', 'Marker Felt', 'Papyrus', 'Zapfino'];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72];
const TEXT_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
const HIGHLIGHT_COLORS = ['#ffffff', '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe'];
const TABLE_STYLES = ['plain', 'striped'];

const Icon = ({ icon }: { icon: string }) => {
    const iconMap: { [key: string]: React.ReactElement } = {
        bold: <BoldIcon />,
        italic: <ItalicIcon />,
        underline: <UnderlineIcon />,
        strikethrough: <StrikethroughIcon />,
        code: <CodeIcon />,
        link: <LinkIcon />,
        quote: <QuoteIcon />,
        h1: <H1Icon />,
        h2: <H2Icon />,
        h3: <H3Icon />,
        numbered_list: <NumberedListIcon />,
        bulleted_list: <BulletedListIcon />,
        align_left: <AlignLeftIcon />,
        align_center: <AlignCenterIcon />,
        align_right: <AlignRightIcon />,
        align_justify: <AlignJustifyIcon />,
        indent: <IndentIcon />,
        outdent: <OutdentIcon />,
        image: <ImageIcon />,
        horizontal_rule: <HorizontalRuleIcon />,
        save: <SaveIcon />,
        open: <OpenIcon />,
        undo: <UndoIcon />,
        redo: <RedoIcon />,
        superscript: <SuperscriptIcon />,
        subscript: <SubscriptIcon />,
        table: <TableIcon />,
        toc: <TocIcon />,
        footnote: <FootnoteIcon />,
        citation: <CitationIcon />,
        shapes: <ShapesIcon />,
        find: <FindIcon />,
        new: <NewIcon />,
        save_as: <SaveAsIcon />,
        print: <PrintIcon />,
        export: <ExportIcon />,
        close: <CloseIcon />,
        share: <ShareIcon />,
        info: <InfoIcon />,
        clear: <ClearFormattingIcon />,
        increase_font: <IncreaseFontSizeIcon />,
        decrease_font: <DecreaseFontSizeIcon />,
        cut: <CutIcon />,
        copy: <CopyIcon />,
        paste: <PasteIcon />,
        settings: <SettingsIcon />,
        template: <TemplateIcon />,
        symbol: <SymbolIcon />,
        contact: <ContactIcon />,
        update: <UpdateIcon />,
        donate: <DonateIcon />,
        insert_row: <Plus />,
        delete_row: <Trash />,
        insert_col: <Columns />,
        delete_col: <Rows />,
    };

    return iconMap[icon] || null;
};

// Helper to safely render an icon value which may be a React component (function) or a React element
const renderIconValue = (iconValue: any) => {
    if (!iconValue) return null;
    try {
        if (typeof iconValue === 'function') {
            return React.createElement(iconValue);
        }
        return iconValue;
    } catch (err) {
        return null;
    }
};

// --- Editor-level Helpers (Plugins) ---
const withPlugins = (editor: Editor) => {
    const { insertData, insertText, isInline, isVoid, normalizeNode } = editor;

    const isValidUrl = (string: string) => {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    };

    editor.isInline = element => ['link', 'footnote', 'citation', 'icon'].includes(element.type) || isInline(element);
    editor.isVoid = element => ['image', 'horizontal-rule', 'footnote', 'icon', 'page-break', 'table-of-contents'].includes(element.type) || isVoid(element);
    editor.insertText = text => { if (text && (isUrl(text) || isValidUrl(text))) wrapLink(editor, text); else insertText(text); };
    editor.insertData = data => { const text = data.getData('text/plain'); if (text && (isUrl(text) || isValidUrl(text))) wrapLink(editor, text); else insertData(data); };

    editor.normalizeNode = entry => {
        const [node, path] = entry;

        // The editor must never be completely empty.
        if (Editor.isEditor(node) && node.children.length === 0) {
            Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] }, { at: [0] });
            return;
        }

        // Headings carry stable ids so the TOC and anchors can target them.
        if (SlateElement.isElement(node) && node.type.startsWith('heading') && !(node as { id?: string }).id) {
            Transforms.setNodes(editor, { id: uuidv4() }, { at: path });
            return;
        }

        // The TOC is a void block whose entries are derived at render time;
        // collapse any legacy (pre-void) children down to a single empty text.
        if (SlateElement.isElement(node) && node.type === 'table-of-contents') {
            if (node.children.length !== 1 || !Text.isText(node.children[0]) || node.children[0].text !== '') {
                Transforms.removeNodes(editor, { at: path });
                Transforms.insertNodes(editor, { type: 'table-of-contents', children: [{ text: '' }] }, { at: path });
                return;
            }
        }

        if (SlateElement.isElement(node) && node.type === 'footnote-container') {
            if (path[0] < editor.children.length - 1) {
                Transforms.moveNodes(editor, { at: path, to: [editor.children.length] });
                return;
            }
        }

        if (SlateElement.isElement(node) && node.type === 'footnote') {
            // A footnote is an inline void; if its block is the document's last,
            // append a trailing paragraph at the END (never at the live caret) so
            // the cursor can escape past the marker without corrupting the tree.
            if (editor.children.length - 1 === path[0]) {
                Transforms.insertNodes(
                    editor,
                    { type: 'paragraph', children: [{ text: '' }] },
                    { at: [editor.children.length] }
                );
            }
        }

        if (SlateElement.isElement(node) && node.type === 'table') {
            const rows = Array.from(Node.children(node, []));
            for (const [row, rowPath] of rows) {
                if (!SlateElement.isElement(row) || row.type !== 'table-row') {
                    Transforms.removeNodes(editor, { at: rowPath });
                    return;
                }
                const cells = Array.from(Node.children(row, []));
                for (const [cell, cellPath] of cells) {
                    if (!SlateElement.isElement(cell) || cell.type !== 'table-cell') {
                        Transforms.removeNodes(editor, { at: cellPath });
                        return;
                    }
                }
            }
        }

        normalizeNode(entry);
    };

    return editor;
};

// --- Logic Helpers ---
const handleIndent = (editor: Editor) => {
    if (!editor.selection) return;
    const blockEntries = Editor.nodes(editor, {
        at: editor.selection,
        match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
    });

    for (const [node, path] of blockEntries) {
        const currentIndent = (node as { indent?: number }).indent || 0;
        Transforms.setNodes(editor, { indent: currentIndent + 1 }, { at: path });
    }
};
const handleOutdent = (editor: Editor) => {
    if (!editor.selection) return;
    const blockEntries = Editor.nodes(editor, {
        at: editor.selection,
        match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n),
    });

    for (const [node, path] of blockEntries) {
        const currentIndent = (node as { indent?: number }).indent || 0;
        if (currentIndent > 0) {
            Transforms.setNodes(editor, { indent: currentIndent - 1 }, { at: path });
        }
    }
};
const insertImage = (editor: Editor, url: string) => { const text = { text: '' }; const image: CustomElement = { type: 'image', url, children: [text] }; Transforms.insertNodes(editor, image); };
const insertHorizontalRule = (editor: Editor) => { const text = { text: '' }; const hr: CustomElement = { type: 'horizontal-rule', children: [text] }; Transforms.insertNodes(editor, hr); };
const insertTable = (editor: Editor) => {
    const table: CustomElement = {
        type: 'table',
        children: [
            {
                type: 'table-row',
                children: [
                    { type: 'table-cell', children: [{ text: '' }] },
                    { type: 'table-cell', children: [{ text: '' }] },
                ]
            },
            {
                type: 'table-row',
                children: [
                    { type: 'table-cell', children: [{ text: '' }] },
                    { type: 'table-cell', children: [{ text: '' }] },
                ]
            },
        ]
    };
    Transforms.insertNodes(editor, table);
};

// Footnotes drop a superscript marker at the caret and append matching content
// to a footnote section at the bottom of the document. The container is always
// created WITH its first content child in a single insert — an element with an
// empty `children: []` array is invalid and used to crash Slate's normalizer.
const insertFootnote = (editor: Editor) => {
    try {
        if (!editor.selection) Transforms.select(editor, Editor.end(editor, []));

        const footnotes = Array.from(
            Editor.nodes(editor, { at: [], match: n => SlateElement.isElement(n) && n.type === 'footnote' })
        );
        const footnoteNumber = footnotes.length + 1;

        Transforms.insertNodes(editor, {
            type: 'footnote',
            number: footnoteNumber,
            children: [{ text: '' }],
        } as CustomElement);

        const footnoteContent: CustomElement = {
            type: 'footnote-content',
            number: footnoteNumber,
            children: [{ text: ' ' }],
        };

        let containerEntry: [Node, number[]] | null = null;
        for (const entry of Editor.nodes(editor, {
            at: [],
            match: n => SlateElement.isElement(n) && n.type === 'footnote-container',
        })) {
            containerEntry = entry as [Node, number[]];
            break;
        }

        if (!containerEntry) {
            Transforms.insertNodes(
                editor,
                { type: 'footnote-container', children: [footnoteContent] } as CustomElement,
                { at: [editor.children.length] }
            );
        } else {
            const [containerNode, containerPath] = containerEntry;
            const insertPath = [...containerPath, (containerNode as SlateElement).children.length];
            Transforms.insertNodes(editor, footnoteContent, { at: insertPath });
        }
    } catch (err) {
        console.error('Failed to insert footnote', err);
    }
};

// Insert the live TOC block. Its entries are derived from the document's
// headings at render time, so it stays in sync as the document changes.
const generateToc = (editor: Editor) => {
    const tocNode: CustomElement = { type: 'table-of-contents', children: [{ text: '' }] };
    Transforms.insertNodes(editor, tocNode);
    Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] });
};

const insertIcon = (editor: Editor, iconName: string) => {
    const iconNode: CustomElement = {
        type: 'icon',
        icon: iconName,
        children: [{ text: '' }],
    };
    Transforms.insertNodes(editor, iconNode);
};

// --- The Master HTML Import Deserializer ---
// Drives every html-import path: .md, .html, and the Pandoc formats (.odt,
// .rtf, .epub, .tex). It must understand tables, styled spans, code, and
// alignment — otherwise tables collapse into flat strings and formatting is
// stripped on import (the original bugs in the QA report).

const INLINE_TYPES = new Set(['link', 'footnote', 'citation', 'icon']);
const isImportInline = (n: any): boolean => !!n && (n.text !== undefined || INLINE_TYPES.has(n.type));

// Group a mixed run of inline + block children into all-block children
// (wrapping stray inline runs in paragraphs) so Slate never sees a block and
// inline as siblings.
const ensureImportBlocks = (kids: any[]): any[] => {
    const blocks: any[] = [];
    let currentInline: any[] = [];
    const flush = () => {
        if (currentInline.length > 0) {
            blocks.push({ type: 'paragraph', children: currentInline });
            currentInline = [];
        }
    };
    kids.forEach(child => {
        if (isImportInline(child)) currentInline.push(child);
        else { flush(); blocks.push(child); }
    });
    flush();
    return blocks.length > 0 ? blocks : [{ type: 'paragraph', children: [{ text: '' }] }];
};

const deserializeHtml = (el: any, markAttributes: any = {}): any => {
    if (el.nodeType === 3) {
        const text = el.textContent.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
        if (text === '') return null;
        return { text, ...markAttributes };
    }
    if (el.nodeType !== 1) return null;

    const nodeAttributes: any = { ...markAttributes };
    const nodeName = el.nodeName.toUpperCase();

    if (['STRONG', 'B'].includes(nodeName)) nodeAttributes.bold = true;
    if (['EM', 'I'].includes(nodeName)) nodeAttributes.italic = true;
    if (['U', 'INS'].includes(nodeName)) nodeAttributes.underline = true;
    if (['S', 'STRIKE', 'DEL'].includes(nodeName)) nodeAttributes.strikethrough = true;
    if (nodeName === 'CODE' || nodeName === 'PRE' || nodeName === 'TT' || nodeName === 'KBD' || nodeName === 'SAMP') nodeAttributes.code = true;
    if (nodeName === 'SUP') nodeAttributes.superscript = true;
    if (nodeName === 'SUB') nodeAttributes.subscript = true;

    const style = el.style;
    if (style) {
        if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600) nodeAttributes.bold = true;
        if (style.fontStyle === 'italic') nodeAttributes.italic = true;
        const decoration = `${style.textDecoration || ''} ${style.textDecorationLine || ''}`;
        if (decoration.includes('underline')) nodeAttributes.underline = true;
        if (decoration.includes('line-through')) nodeAttributes.strikethrough = true;
        if (style.color) nodeAttributes.color = style.color;
        if (style.backgroundColor) nodeAttributes.backgroundColor = style.backgroundColor;
        if (style.fontFamily) nodeAttributes.fontFamily = style.fontFamily.replace(/['"]/g, '');
        if (style.fontSize) {
            const sizeMatch = style.fontSize.match(/(\d+)/);
            if (sizeMatch) nodeAttributes.fontSize = parseInt(sizeMatch[1]);
        }
        if (style.verticalAlign === 'super') nodeAttributes.superscript = true;
        if (style.verticalAlign === 'sub') nodeAttributes.subscript = true;
    }

    let children = Array.from(el.childNodes)
        .map((node: any) => deserializeHtml(node, nodeAttributes))
        .flat()
        .filter(Boolean);

    if (children.length === 0) children = [{ text: '' }];

    // Block-level layout props pulled from inline CSS (Pandoc/HTML emit these).
    const blockProps: any = {};
    if (style) {
        if (['left', 'center', 'right', 'justify'].includes(style.textAlign)) blockProps.align = style.textAlign;
        const lh = parseFloat(style.lineHeight);
        if (!isNaN(lh) && lh > 0 && lh < 10) blockProps.lineHeight = lh;
    }

    switch (nodeName) {
        case 'BODY':
        case 'DIV':
        case 'ARTICLE':
        case 'SECTION':
        case 'MAIN':
        case 'HEADER':
        case 'FOOTER':
            return ensureImportBlocks(children);
        case 'P': return { type: 'paragraph', ...blockProps, children };
        case 'H1': return { type: 'heading-one', ...blockProps, children };
        case 'H2': return { type: 'heading-two', ...blockProps, children };
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6': return { type: 'heading-three', ...blockProps, children };
        case 'BLOCKQUOTE': {
            // Flatten any wrapping <p> (Pandoc nests quote text) so the quote
            // stays a single inline-content block, not a block-in-block.
            const inlineKids: any[] = [];
            children.forEach(c => {
                if (isImportInline(c)) inlineKids.push(c);
                else if (c.children) inlineKids.push(...c.children);
            });
            return { type: 'block-quote', ...blockProps, children: inlineKids.length > 0 ? inlineKids : [{ text: '' }] };
        }
        case 'PRE': return { type: 'paragraph', children };
        case 'UL':
        case 'OL': {
            const items = children.filter((c: any) => c && c.type === 'list-item');
            if (items.length === 0) return null;
            return { type: nodeName === 'UL' ? 'bulleted-list' : 'numbered-list', children: items };
        }
        case 'LI': return { type: 'list-item', children };
        case 'A': {
            const texts = children.filter((c: any) => c.text !== undefined || c.type === 'icon');
            return { type: 'link', url: el.getAttribute('href') || '#', children: texts.length > 0 ? texts : [{ text: el.getAttribute('href') || '' }] };
        }
        case 'IMG': {
            const src = el.getAttribute('src');
            if (!src) return null;
            const width = parseInt(el.getAttribute('width') || '', 10);
            const height = parseInt(el.getAttribute('height') || '', 10);
            return {
                type: 'image',
                url: src,
                ...(width > 0 ? { width } : {}),
                ...(height > 0 ? { height } : {}),
                children: [{ text: '' }],
            };
        }
        case 'HR':
            return {
                type: (el.getAttribute('class') || '').includes('page-break') ? 'page-break' : 'horizontal-rule',
                children: [{ text: '' }],
            };
        case 'BR': return { text: '\n', ...nodeAttributes };
        case 'TABLE': {
            const rows = children.filter((c: any) => c && c.type === 'table-row');
            return rows.length > 0 ? { type: 'table', children: rows } : ensureImportBlocks(children);
        }
        case 'THEAD':
        case 'TBODY':
        case 'TFOOT':
            return children; // flattened into the parent <table>'s rows
        case 'TR': {
            const cells = children.filter((c: any) => c && c.type === 'table-cell');
            return cells.length > 0 ? { type: 'table-row', children: cells } : null;
        }
        case 'TD':
        case 'TH': {
            const bg = style?.backgroundColor;
            return {
                type: 'table-cell',
                ...(nodeName === 'TH' ? { header: true } : {}),
                ...(bg ? { backgroundColor: bg } : {}),
                children: ensureImportBlocks(children),
            };
        }
        case 'CAPTION':
        case 'COLGROUP':
        case 'COL':
        case 'STYLE':
        case 'SCRIPT':
            return null;
        default:
            return children;
    }
};

// True for light fills (so we can pick a dark, readable text color on top of
// them). Imported tables often carry light cell shading; without this, the
// editor's dark-mode default (white) text renders white-on-white = invisible.
const isLightColor = (color?: string): boolean => {
    if (!color) return false;
    let r: number, g: number, b: number;
    const hex = color.trim().replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
    } else if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
    } else {
        const m = color.match(/\d+/g);
        if (!m || m.length < 3) return false;
        [r, g, b] = m.map(Number);
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
};

// --- Component Renderers ---
const Leaf = ({ attributes, children, leaf }: any) => {
    let style: React.CSSProperties = {};
    if (leaf.bold) style.fontWeight = 'bold';
    if (leaf.italic) style.fontStyle = 'italic';
    // Underline and strikethrough are both text-decoration: combine them so a
    // single text node can carry every mark at once (bold+italic+underline+strike)
    // instead of the last-applied decoration silently overriding the other.
    const decorations: string[] = [];
    if (leaf.underline) decorations.push('underline');
    if (leaf.strikethrough) decorations.push('line-through');
    if (decorations.length) style.textDecoration = decorations.join(' ');
    if (leaf.fontFamily) style.fontFamily = leaf.fontFamily;
    // Sizes are points (what the size dropdown shows). Render in pt so the
    // editor is WYSIWYG with the page and exports match Word exactly — using px
    // made a "72" run export as 54pt (72px × 0.75 = 54pt).
    if (leaf.fontSize) style.fontSize = `${leaf.fontSize}pt`;
    if (leaf.color) style.color = leaf.color;
    if (leaf.backgroundColor) style.backgroundColor = leaf.backgroundColor;
    if (leaf.superscript) style.verticalAlign = 'super';
    if (leaf.subscript) style.verticalAlign = 'sub';

    if (leaf.code) return <code {...attributes} style={style} className="bg-gray-200 dark:bg-gray-700 p-1 rounded text-sm font-mono">{children}</code>;
    if (leaf.link) return <a href={leaf.link} {...attributes} style={style} className="text-blue-500 hover:underline">{children}</a>;
    return <span {...attributes} style={style}>{children}</span>;
};

// Live Table of Contents: a void block whose entries are computed from the
// current document headings on every change. Clicking an entry scrolls to it.
const TableOfContentsBlock = ({ attributes, children }: any) => {
    const editor = useSlate();
    const headings = editor.children.filter(
        (n): n is CustomElement =>
            SlateElement.isElement(n) && n.type.startsWith('heading') && Node.string(n).trim() !== ''
    );

    const scrollToHeading = (heading: CustomElement) => {
        try {
            ReactEditor.toDOMNode(editor, heading).scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            console.warn('Could not scroll to heading', err);
        }
    };

    return (
        <div {...attributes}>
            <div
                contentEditable={false}
                title="Auto-generated from Heading 1–3. Edit your headings to update it — the list itself is not directly editable."
                className="p-4 my-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 select-none"
            >
                <div className="flex items-center text-xs font-semibold uppercase tracking-widest text-gray-500">
                    <List size={14} className="mr-2" /> Table of Contents
                </div>
                <p className="text-[11px] italic text-gray-400 mb-2">Auto-generated from Heading 1–3 · not directly editable</p>
                {headings.length === 0 ? (
                    <p className="text-sm italic text-gray-400">Add headings (H1–H3) and they will appear here automatically.</p>
                ) : (
                    headings.map((heading, i) => {
                        const level = heading.type === 'heading-one' ? 0 : heading.type === 'heading-two' ? 1 : 2;
                        return (
                            <button
                                key={(heading as { id?: string }).id ?? i}
                                className="block w-full text-left text-sm py-0.5 text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
                                style={{ paddingLeft: level * 16 }}
                                onClick={() => scrollToHeading(heading)}
                            >
                                {Node.string(heading)}
                            </button>
                        );
                    })
                )}
            </div>
            {children}
        </div>
    );
};

const Element = (props: any) => {
    const { attributes, children, element } = props;
    const editor = useSlateStatic();
    const style: React.CSSProperties = {
        textAlign: element.align,
        lineHeight: element.lineHeight,
    };

    if (element.hangingIndent) {
        style.paddingLeft = '2em';
        style.textIndent = '-2em';
    } else if (element.indent) {
        style.paddingLeft = `${element.indent * 2}em`;
    }

    const selected = useSelected();
    const focused = useFocused();

    switch (element.type) {
        case 'link': return <a {...attributes} href={element.url} style={style} className="text-blue-500 hover:underline">{children}</a>;
        case 'image':
            return (
                <div {...attributes}>
                    <div contentEditable={false}>
                        <Resizable
                            defaultSize={{
                                width: element.width || 500,
                                height: element.height || 'auto',
                            }}
                            onResizeStop={(e, direction, ref, d) => {
                                const path = ReactEditor.findPath(editor, element);
                                Transforms.setNodes(editor, { width: ref.style.width, height: ref.style.height }, { at: path });
                            }}
                            className="flex justify-center"
                        >
                            <img src={element.url} style={{ width: '100%', height: '100%', boxShadow: selected && focused ? '0 0 0 3px #B4D5FF' : 'none' }} className="block max-w-full h-auto" />
                        </Resizable>
                    </div>
                    <div style={{ display: 'none' }}>{children}</div>
                </div>
            );
            case 'page-break':
            // Full-bleed gutter band (breaks out past the page's 1in padding) so
            // the break reads as the end of one sheet and the start of the next,
            // the way Word shows a page boundary — not just a dashed line.
            return (
                <div {...attributes} contentEditable={false} className="select-none my-6" style={{ marginLeft: '-1in', marginRight: '-1in' }}>
                    <div className="h-12 bg-gray-200 dark:bg-gray-900 border-y border-gray-300 dark:border-gray-700 shadow-inner flex items-center justify-center">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">⤓ Page Break · new page</span>
                    </div>
                    <div style={{ display: 'none' }}>{children}</div>
                </div>
            );
        case 'icon':
            const allIcons = [...iconList.shapes, ...iconList.symbols, ...iconList.emojis, ...iconList.media];
            const icon = allIcons.find(i => i.name === element.icon);
            return (
                <span {...attributes}>
                    <span contentEditable={false} style={{ display: 'inline-block', fontSize: '1.5em' }}>
                        {icon ? renderIconValue(icon.icon) : null}
                    </span>
                    {children}
                </span>
            );
                case 'horizontal-rule':
            return (
                <div {...attributes}>
                    <div contentEditable={false}>
                        <hr className="my-4 border-gray-300 dark:border-gray-600" />
                    </div>
                    {children}
                </div>
            );
        case 'block-quote': return <blockquote style={style} className="border-l-4 pl-4 italic text-gray-500" {...attributes}>{children}</blockquote>;
        case 'heading-one': return <h1 id={element.id} style={style} className="text-3xl font-bold mb-2" {...attributes}>{children}</h1>;
        case 'heading-two': return <h2 id={element.id} style={style} className="text-2xl font-semibold mb-1" {...attributes}>{children}</h2>;
        case 'heading-three': return <h3 id={element.id} style={style} className="text-xl font-semibold mb-1" {...attributes}>{children}</h3>;
        case 'list-item': return <li style={style} {...attributes}>{children}</li>;
        case 'numbered-list': return <ol style={style} className="list-decimal list-inside" {...attributes}>{children}</ol>;
        case 'bulleted-list': return <ul style={style} className="list-disc list-inside" {...attributes}>{children}</ul>;
        
        // THE FIX: Footnotes styled nicely
        case 'footnote': return <span {...attributes} contentEditable={false} className="text-blue-500 cursor-pointer mx-1" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>[{element.number}]{children}</span>;
        // Citation is an editable inline (like a link). It must NOT be
        // contentEditable={false}: forcing a non-void inline with real text
        // children to be non-editable desyncs Slate's selection model and throws.
        case 'citation': return <span {...attributes} className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-sm">{children}</span>;
        case 'footnote-container': return <div {...attributes} className="mt-8 pt-4 border-t-2 border-gray-300 dark:border-gray-600">{children}</div>;
        case 'footnote-content': return <div {...attributes} className="flex items-start mb-2"><span className="text-sm font-bold mr-2">{element.number}.</span><div className="flex-grow">{children}</div></div>;
        
        // Tables constrained to page bounds; controls live in the floating table toolbar
        case 'table': return <table {...attributes} style={{ width: '100%', tableLayout: 'fixed' }} className={`w-full border-collapse border border-gray-400 dark:border-gray-600 break-words my-2 ${element.tableStyle === 'striped' ? 'striped-table' : ''}`}><tbody>{children}</tbody></table>;
        case 'table-row':
            return <tr {...attributes} style={{ height: element.height }}>{children}</tr>;
        case 'table-cell': {
            const cell = element as TableCellElement;
            const cellStyle: React.CSSProperties = {
                width: cell.width,
                backgroundColor: cell.backgroundColor,
                fontWeight: cell.header ? 600 : undefined,
                // Keep shaded cells readable in either theme: pick contrasting
                // text instead of inheriting the dark-mode white default.
                color: cell.backgroundColor ? (isLightColor(cell.backgroundColor) ? '#111827' : '#ffffff') : undefined,
            };
            return (
                <td
                    {...attributes}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    style={cellStyle}
                    className="border border-gray-300 dark:border-gray-700 p-2 relative overflow-hidden break-words align-top"
                >
                    <div
                        contentEditable={false}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', userSelect: 'none' }}
                        onMouseDown={e => {
                            e.preventDefault();
                            const path = ReactEditor.findPath(editor, element);
                            const startX = e.clientX;
                            const cellEl = (e.target as HTMLElement).closest('td');
                            const startWidth = cellEl ? cellEl.offsetWidth : 100;
                            const mouseMove = (ev: MouseEvent) => {
                                const newWidth = Math.max(32, startWidth + (ev.clientX - startX));
                                Transforms.setNodes(editor, { width: newWidth }, { at: path });
                            };
                            const mouseUp = () => {
                                document.removeEventListener('mousemove', mouseMove);
                                document.removeEventListener('mouseup', mouseUp);
                            };
                            document.addEventListener('mousemove', mouseMove);
                            document.addEventListener('mouseup', mouseUp);
                        }}
                    />
                    {children}
                </td>
            );
        }
        case 'table-of-contents': return <TableOfContentsBlock {...props} />;
        default: return <p style={style} className="leading-relaxed my-1" {...attributes}>{children}</p>;
    }
};

// Memoized renderers keep typing fast in long documents: unchanged blocks
// skip re-rendering entirely (Element subscribes via useSlateStatic, so the
// editor context no longer forces a full-tree render on every keystroke).
const MemoizedElement = React.memo(Element);
const MemoizedLeaf = React.memo(Leaf);

const LINE_SPACING_VALUES = [1, 1.15, 1.5, 2, 2.5, 3];

const LineSpacingDropdown = () => {
    const editor = useSlate();

    const setLineSpacing = (lineHeight: number) => {
        Transforms.setNodes(
            editor,
            { lineHeight },
            { match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n) }
        );
    };

    return (
        <select
            className="px-2 py-1 text-sm rounded bg-white text-gray-900 outline-none border border-gray-300"
            onChange={e => {
                e.preventDefault();
                const value = parseFloat(e.target.value);
                if (value) {
                    setLineSpacing(value);
                } else { 
                    Transforms.unsetNodes(editor, 'lineHeight', { match: n => SlateElement.isElement(n) && Editor.isBlock(editor, n) });
                }
            }}
        >
            <option value="">Line Spacing</option>
            {LINE_SPACING_VALUES.map(value => (
                <option key={value} value={value}>{value}</option>
            ))}
        </select>
    );
};

// --- Toolbar Components ---
const MarkButton = ({ format, icon }: { format: any, icon: string }) => { const editor = useSlate(); return <button title={format} className={`p-2 rounded ${isMarkActive(editor, format) ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onMouseDown={event => { event.preventDefault(); toggleMark(editor, format); }}><Icon icon={icon} /></button>; };

const ClearFormattingButton = () => {
    const editor = useSlate();

    const handleClearFormatting = () => {
        const marks = Editor.marks(editor);
        if (marks) {
            for (const key in marks) {
                if(key !== 'link') {
                    Editor.removeMark(editor, key);
                }
            }
        }
    };

    return (
        <button title="Clear Formatting" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
            event.preventDefault();
            handleClearFormatting();
        }}>
            <Icon icon="clear" />
        </button>
    );
};

const IncreaseFontSizeButton = () => {
    const editor = useSlate();
    return <button title="Increase Font Size" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
        event.preventDefault();
        const marks = Editor.marks(editor);
        const currentSize = marks?.fontSize || 12;
        const currentIndex = FONT_SIZES.findIndex(size => size >= currentSize);
        const newSize = FONT_SIZES[Math.min(currentIndex + 1, FONT_SIZES.length - 1)];
        addMarkData(editor, 'fontSize', newSize);
    }}><Icon icon="increase_font" /></button>;
}

const DecreaseFontSizeButton = () => {
    const editor = useSlate();
    return <button title="Decrease Font Size" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
        event.preventDefault();
        const marks = Editor.marks(editor);
        const currentSize = marks?.fontSize || 12;
        const currentIndex = FONT_SIZES.findIndex(size => size >= currentSize);
        const newSize = FONT_SIZES[Math.max(currentIndex - 1, 0)];
        addMarkData(editor, 'fontSize', newSize);
    }}><Icon icon="decrease_font" /></button>;
}

const CutButton = () => {
    return <button title="Cut" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={e => { e.preventDefault(); document.execCommand('cut'); }}><Icon icon="cut" /></button>;
}

const CopyButton = () => {
    return <button title="Copy" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={e => { e.preventDefault(); document.execCommand('copy'); }}><Icon icon="copy" /></button>;
}

const PasteButton = () => {
    return <button title="Paste" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={e => { e.preventDefault(); document.execCommand('paste'); }}><Icon icon="paste" /></button>;
}

const BlockButton = ({ format, icon }: { format: any, icon: string }) => { const editor = useSlate(); return <button title={format} className={`p-2 rounded ${isBlockActive(editor, format, TEXT_ALIGN_TYPES.includes(format) ? 'align' : 'type') ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onMouseDown={event => { event.preventDefault(); toggleBlock(editor, format); }}><Icon icon={icon} /></button>; };
const LinkButton = () => {
    const editor = useSlate();
    const [show, setShow] = useState(false);
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');

    const handleClick = () => {
        // Toggle off an existing link without prompting.
        if (isLinkActive(editor)) { unwrapLink(editor); return; }
        const sel = editor.selection;
        const selected = sel && !Range.isCollapsed(sel) ? Editor.string(editor, sel) : '';
        setText(selected);
        setUrl('');
        setShow(true);
    };

    const submit = () => {
        const trimmed = url.trim();
        if (trimmed) {
            // Default to an https:// scheme so bare "google.com" still links out.
            const href = /^[a-z][a-z0-9+.-]*:|^#|^\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            insertLink(editor, href, text.trim());
        }
        setShow(false);
        setTimeout(() => { try { ReactEditor.focus(editor); } catch { /* not mounted */ } }, 0);
    };

    return (
        <>
            <button title="Link" className={`p-2 rounded ${isLinkActive(editor) ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onMouseDown={event => { event.preventDefault(); handleClick(); }}><Icon icon="link" /></button>
            {show && (
                <Modal onClose={() => setShow(false)}>
                    <h2 className="text-lg font-bold mb-3">Insert Link</h2>
                    <label className="block text-sm font-medium mb-1">URL</label>
                    <input
                        autoFocus
                        type="text"
                        value={url}
                        placeholder="https://example.com"
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                        className="w-full p-2 mb-3 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <label className="block text-sm font-medium mb-1">Display Text <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                        type="text"
                        value={text}
                        placeholder="Defaults to the URL"
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                        className="w-full p-2 mb-4 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setShow(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                        <button onClick={submit} disabled={!url.trim()} className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">Insert</button>
                    </div>
                </Modal>
            )}
        </>
    );
};
const IndentButton = ({ action }: { action: 'indent' | 'outdent' }) => { const editor = useSlate(); return <button title={action} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); if (action === 'indent') handleIndent(editor); else handleOutdent(editor); }}><Icon icon={action} /></button>; };
const InsertImageButton = () => {
    const editor = useSlate();
    const handleInsertImage = async () => {
        let dataUrl: any = null;
        try {
            dataUrl = await (window as any).api.openImageDialog();
        } catch (err) {
            console.warn('IPC image dialog failed, falling back to renderer file input', err);
        }

        const safeInsert = (url: any) => {
            try {
                if (typeof url !== 'string') {
                    console.warn('InsertImage: received non-string url, converting to string', url);
                    url = String(url);
                }
                const textNode = { text: '' };
                const image: CustomElement = { type: 'image', url, children: [textNode] } as any;
                console.debug('Inserting image node:', image);
                Transforms.insertNodes(editor, image);
            } catch (err) {
                console.error('Failed to insert image node', err, url);
                alert('Failed to insert image: ' + (err && (err as Error).message ? (err as Error).message : String(err)));
            }
        };

        if (dataUrl) {
            safeInsert(dataUrl);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                if (result) {
                    safeInsert(result);
                } else {
                    alert('Failed to read image file.');
                }
            };
            reader.onerror = (e) => {
                console.error('FileReader error', e);
                alert('Failed to read image file.');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };
    return <button title="Image" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); handleInsertImage(); }}><Icon icon="image" /></button>;
};
const InsertTableButton = () => { const editor = useSlate(); return <button title="Table" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); insertTable(editor); }}><Icon icon="table" /></button>; };
const InsertTocButton = () => { const editor = useSlate(); return <button title="Table of Contents" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); generateToc(editor); }}><Icon icon="toc" /></button>; };
const InsertHorizontalRuleButton = () => { const editor = useSlate(); return <button title="Horizontal Rule" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); insertHorizontalRule(editor); }}><Icon icon="horizontal_rule" /></button>; };
const InsertFootnoteButton = () => { const editor = useSlate(); return <button title="Footnote" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); insertFootnote(editor); }}><Icon icon="footnote" /></button>; };
const InsertCitationButton = () => {
    const editor = useSlate();
    const [show, setShow] = useState(false);
    const [source, setSource] = useState('');

    const submit = () => {
        const value = source.trim();
        if (value) {
            const citation: CustomElement = { type: 'citation', children: [{ text: value }] };
            Transforms.insertNodes(editor, citation);
        }
        setSource('');
        setShow(false);
        setTimeout(() => { try { ReactEditor.focus(editor); } catch { /* not mounted */ } }, 0);
    };

    return (
        <>
            <button title="Citation" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); setShow(true); }}><Icon icon="citation" /></button>
            {show && (
                <Modal onClose={() => setShow(false)}>
                    <h2 className="text-lg font-bold mb-3">Insert Citation</h2>
                    <label className="block text-sm font-medium mb-1">Source</label>
                    <input
                        autoFocus
                        type="text"
                        value={source}
                        placeholder="e.g. Smith, 2026"
                        onChange={e => setSource(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                        className="w-full p-2 mb-4 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setShow(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                        <button onClick={submit} disabled={!source.trim()} className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">Insert</button>
                    </div>
                </Modal>
            )}
        </>
    );
};
const InsertRowButton = ({ editor }: { editor: Editor }) => {
    return <button title="Insert Row" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
        event.preventDefault();
        insertTableRow(editor, 'below');
    }}><Icon icon="insert_row" /></button>;
};

const DeleteRowButton = ({ editor }: { editor: Editor }) => {
    return <button title="Delete Row" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
        event.preventDefault();
        deleteTableRow(editor);
    }}><Icon icon="delete_row" /></button>;
};

const InsertColumnButton = ({ editor }: { editor: Editor }) => {
    return <button title="Insert Column" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
        event.preventDefault();
        insertTableColumn(editor, 'right');
    }}><Icon icon="insert_col" /></button>;
};

const DeleteColumnButton = ({ editor }: { editor: Editor }) => {
    return <button title="Delete Column" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onMouseDown={event => {
        event.preventDefault();
        deleteTableColumn(editor);
    }}><Icon icon="delete_col" /></button>;
};

const InsertPageBreakButton = () => {
    const editor = useSlate();
    return (
        <button title="Page Break" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => {
            event.preventDefault();
            const pb: CustomElement = { type: 'page-break', children: [{ text: '' }] };
            Transforms.insertNodes(editor, pb);
            Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] });
        }}>
            <span className="font-bold text-xs">PB</span>
        </button>
    );
};

const InsertIconButton = () => {
    const editor = useSlate();
    const [showModal, setShowModal] = useState(false);

    const handleInsertIcon = (iconName: string) => {
        insertIcon(editor, iconName);
        setShowModal(false);
    };

    return (
        <>
            <button title="Insert Icon" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); setShowModal(true); }}><Icon icon="shapes" /></button>
            {showModal && (
                <Modal onClose={() => setShowModal(false)}>
                    <h2 className="text-lg font-bold">Insert Icon</h2>
                                    <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
                        {(Object.keys(iconList) as (keyof typeof iconList)[]).map(category => (
                            <div key={category}>
                                <h3 className="text-md font-bold capitalize mt-4">{category}</h3>
                                <div className="grid grid-cols-6 gap-2 mt-2">
                                    {iconList[category].map((icon: { name: string; icon: unknown }) => (
                                        <button
                                            key={icon.name}
                                            onClick={() => handleInsertIcon(icon.name)}
                                            className="p-4 rounded border-2 hover:border-blue-500 flex justify-center items-center"
                                        >
                                            <span className="text-2xl">{renderIconValue(icon.icon)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </>
    );
};

const InsertSymbolButton = () => {
    const editor = useSlate();
    const [show, setShow] = useState(false);

    const insertSymbol = (char: string) => {
        // Insert as plain text so it embeds natively in every export format.
        try { ReactEditor.focus(editor); } catch { /* not mounted */ }
        editor.insertText(char);
    };

    return (
        <>
            <button title="Symbol" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={event => { event.preventDefault(); setShow(true); }}><Icon icon="symbol" /></button>
            {show && (
                <Modal onClose={() => setShow(false)}>
                    <h2 className="text-lg font-bold">Insert Symbol</h2>
                    <p className="text-sm text-gray-500 mt-1">Inserted as text — saves into Word, PDF, and ODT.</p>
                    <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
                        {Object.keys(SYMBOL_GROUPS).map(group => (
                            <div key={group}>
                                <h3 className="text-md font-bold mt-4">{group}</h3>
                                <div className="grid grid-cols-8 gap-1 mt-2">
                                    {SYMBOL_GROUPS[group].map((char, i) => (
                                        <button
                                            key={`${group}-${i}`}
                                            onMouseDown={e => { e.preventDefault(); insertSymbol(char); }}
                                            className="p-2 rounded border-2 border-transparent hover:border-blue-500 flex justify-center items-center text-xl"
                                        >
                                            {char}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </>
    );
};

const SaveAsButton = ({ onSaveAs }: { onSaveAs: () => void }) => {
    return <button title="Save As" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); onSaveAs(); }}><Icon icon="save_as" /></button>;
}

const PrintButton = () => {
    const handlePrint = () => {
        window.print();
    };
    return <button title="Print" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={handlePrint}><Icon icon="print" /></button>;
}

const ExportButton = ({ onExport }: { onExport: () => void }) => {
    return <button title="Export to PDF" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); onExport(); }}><Icon icon="export" /></button>;
}

const CloseButton = () => {
    const handleClose = () => {
        window.close();
    };
    return <button title="Close" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={handleClose}><Icon icon="close" /></button>;
}

const ShareButton = ({ editor }: { editor: Editor }) => {
    const [showModal, setShowModal] = useState(false);

    const handleShare = (method: 'email' | 'clipboard') => {
        if (method === 'email') {
            const subject = 'Check out this document';
            const body = 'I wanted to share this document with you.';
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        } else if (method === 'clipboard') {
            try {
                const content = editor.children.map(node => Node.string(node)).join('\n');
                (window as any).api.writeText(content);
                alert('Copied to clipboard!');
            } catch (error) {
                alert(`Failed to copy to clipboard: ${(error as Error).message}`);
            }
        }
        setShowModal(false);
    };

    return (
        <div className="relative">
            <button title="Share" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onClick={() => setShowModal(!showModal)}><Icon icon="share" /></button>
            {showModal && (
                <div className="absolute top-10 right-0 bg-white dark:bg-gray-800 p-4 rounded shadow-lg z-20 w-48">
                    <div className="flex flex-col space-y-2">
                        <button onClick={() => handleShare('email')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left">Share via Email</button>
                        <button onClick={() => handleShare('clipboard')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left">Copy to Clipboard</button>
                        <button onClick={() => setShowModal(false)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

const Modal = ({ children, onClose }: { children: React.ReactNode, onClose: () => void }) => {
    const modalContentRef = useRef<HTMLDivElement>(null);

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (modalContentRef.current && event.target === event.currentTarget) {
            onClose();
        }
    };
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return ReactDOM.createPortal(
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
            onMouseDown={handleBackdropClick}
        >
            <div ref={modalContentRef} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md text-black dark:text-white max-h-[85vh] overflow-y-auto">
                {children}
            </div>
        </div>,
        document.body
    );
};

const InfoButton = () => {
    const [showModal, setShowModal] = useState(false);
    const [info, setInfo] = useState<{ version: string; platform: string; arch: string; electron: string } | null>(null);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        if (showModal && !info) window.api.getAppInfo().then(setInfo).catch(() => { /* unavailable */ });
    }, [showModal, info]);

    const checkUpdates = async () => {
        setChecking(true);
        try {
            const result = await window.api.checkForUpdates();
            if (!result.supported) {
                toast(
                    result.reason === 'dev'
                        ? 'Updates apply to installed builds only.'
                        : 'Automatic updates aren’t configured for this build yet.',
                    { type: 'info' }
                );
            } else {
                toast('Checking for updates…', { type: 'info' });
            }
        } catch {
            toast('Could not check for updates.', { type: 'error' });
        } finally {
            setChecking(false);
        }
    };

    return (
        <>
            <button title="About Scribe" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onClick={() => setShowModal(true)}><Icon icon="info" /></button>
            {showModal && (
                <Modal onClose={() => setShowModal(false)}>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✒️</span>
                        <h2 className="text-xl font-bold">Scribe</h2>
                    </div>
                    <p className="my-2 text-sm text-gray-500 dark:text-gray-400">An offline-first word processor built with Electron, React, and Slate.</p>
                    <div className="text-sm space-y-1 mt-3">
                        <p><span className="font-medium">Version:</span> {info?.version ?? '…'}</p>
                        {info && <p className="text-gray-500 dark:text-gray-400">{info.platform}/{info.arch} · Electron {info.electron}</p>}
                    </div>
                    <h3 className="text-md font-bold mt-4">Quick Tips</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Highlight text to bring up the floating format bar.</li>
                        <li>Insert images, tables, symbols, and more from the Insert tab.</li>
                        <li>Found a bug? Use Send Feedback in the File tab.</li>
                    </ul>
                    <div className="flex justify-between items-center mt-5">
                        <button onClick={checkUpdates} disabled={checking} className="flex items-center gap-2 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm disabled:opacity-50">
                            <Icon icon="update" /> {checking ? 'Checking…' : 'Check for updates'}
                        </button>
                        <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Close</button>
                    </div>
                </Modal>
            )}
        </>
    );
}

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xbdevyeo';
const CONTACT_TYPES = ['Bug report', 'Feature request', 'Question', 'Other'];

const ContactButton = () => {
    const [show, setShow] = useState(false);
    const [type, setType] = useState(CONTACT_TYPES[0]);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const reset = () => { setType(CONTACT_TYPES[0]); setEmail(''); setMessage(''); };

    const submit = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        try {
            const info = await window.api.getAppInfo().catch(() => null);
            const res = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    email: email.trim() || undefined,
                    _subject: `Scribe — ${type}`,
                    type,
                    message: message.trim(),
                    appVersion: info?.version,
                    platform: info ? `${info.platform}/${info.arch}` : undefined,
                }),
            });
            if (res.ok) {
                toast('Message sent — thank you!', { type: 'success' });
                reset();
                setShow(false);
            } else {
                const data = await res.json().catch(() => null);
                toast(data?.errors?.[0]?.message ?? 'Could not send message. Please try again.', { type: 'error' });
            }
        } catch {
            toast("Couldn't send — check your internet connection.", { type: 'error' });
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <button title="Send Feedback" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); setShow(true); }}><Icon icon="contact" /></button>
            {show && (
                <Modal onClose={() => setShow(false)}>
                    <h2 className="text-lg font-bold">Send Feedback</h2>
                    <p className="text-sm text-gray-500 mt-1">Found a bug or want a feature? Tell us — it goes straight to the team.</p>
                    <div className="mt-4 space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Your email <span className="text-gray-400 font-normal">(optional, so we can reply)</span></label>
                            <input type="email" value={email} placeholder="you@example.com" onChange={e => setEmail(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Message</label>
                            <textarea value={message} placeholder="What happened, or what would you like to see?" rows={5} onChange={e => setMessage(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none" />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                        <button onClick={() => setShow(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                        <button onClick={submit} disabled={!message.trim() || sending} className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button>
                    </div>
                </Modal>
            )}
        </>
    );
};

const SaveButton = ({ onSave }: { onSave: () => void }) => {
    return <button title="Save" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); onSave(); }}><Icon icon="save" /></button>;
};

const OpenButton = ({ onOpen }: { onOpen: () => void }) => {
    return <button title="Open" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); onOpen(); }}><Icon icon="open" /></button>;
};

const Dropdown = ({ mark, options, placeholder }: { mark: string, options: any[], placeholder: string }) => { 
    const editor = useSlate(); 
    return <select className="px-2 py-1 text-sm rounded bg-white text-gray-900 outline-none border border-gray-300" onChange={e => { e.preventDefault(); addMarkData(editor, mark as any, e.target.value); }}><option value="">{placeholder}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>; 
};
const TableStyleDropdown = ({ options, placeholder }: { options: any[], placeholder: string }) => {
    const editor = useSlate();
    return (
        <select
            className="px-2 py-1 text-sm rounded bg-white text-gray-900 outline-none border border-gray-300"
            onChange={e => {
                e.preventDefault();
                const [table] = Editor.nodes(editor, { match: n => SlateElement.isElement(n) && n.type === 'table' });
                if (table) {
                    Transforms.setNodes(editor, { tableStyle: e.target.value as 'plain' | 'striped' }, { at: table[1] });
                }
            }}
        >
            <option value="">{placeholder}</option>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
    );
};
const ColorPicker = ({ mark, colors }: { mark: string, colors: string[] }) => {
    const editor = useSlate();
    return (
        <div className="flex items-center space-x-1">
            {colors.map(color => <button key={color} className="w-5 h-5 rounded-full border-2 border-transparent hover:border-gray-400" style={{ backgroundColor: color }} onMouseDown={e => { e.preventDefault(); addMarkData(editor, mark as any, color); }} />)}
            <input type="color" className="w-6 h-6" onInput={e => addMarkData(editor, mark as any, (e.target as HTMLInputElement).value)} />
            {/* Revert to the document default by REMOVING the mark, rather than
                stamping an explicit white that prints invisibly on export. */}
            <button
                title={mark === 'backgroundColor' ? 'No highlight' : 'Automatic (default) color'}
                className="w-5 h-5 rounded-full border border-gray-400 text-[10px] leading-none flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
                onMouseDown={e => { e.preventDefault(); Editor.removeMark(editor, mark as any); }}
            >
                ⌫
            </button>
        </div>
    );
};
const ToolbarSection = ({ children }: { children: React.ReactNode }) => <div className="flex items-center space-x-2 p-2">{children}</div>;
const RibbonTab = ({ title, active, onClick }: { title: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-60 hover:opacity-100'}`}
    >
        {title}
        {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
    </button>
);
const StatusBar = ({ wordCount, charCount, theme, themes, customTheme }: { wordCount: number, charCount: number, theme: string, themes: any, customTheme: any }) => {
    const style = theme === 'custom' ? { backgroundColor: customTheme.toolbar, color: customTheme.text } : {};
    const themeClasses = theme !== 'custom' ? `${themes[theme].toolbar} ${themes[theme].text}` : '';

    return (
        <div className={`print:hidden text-xs px-4 py-1 flex justify-end space-x-6 border-t border-gray-300 dark:border-gray-700 ${themeClasses}`} style={style}>
            <span className="font-medium opacity-80">Characters: {charCount}</span>
            <span className="font-medium opacity-80">Words: {wordCount}</span>
        </div>
    );
};

const FindReplace = ({ editor }: { editor: Editor }) => {
    const [search, setSearch] = useState('');
    const [replace, setReplace] = useState('');
    const [foundRange, setFoundRange] = useState<Range | null>(null);
    const [show, setShow] = useState(false);

    const handleFind = useCallback(() => {
        if (!search) return;
        const [match] = Editor.nodes(editor, {
            at: foundRange?.focus || editor.selection?.focus || Editor.end(editor, []),
            match: n => Text.isText(n) && n.text.toLowerCase().includes(search.toLowerCase()),
            reverse: true,
        });

        if (match) {
            const [node, path] = match;
            const offset = (node as Text).text.toLowerCase().lastIndexOf(search.toLowerCase(), foundRange ? Range.start(foundRange).offset - 1 : undefined);
            const range = { 
                anchor: { path, offset }, 
                focus: { path, offset: offset + search.length }
            };
            setFoundRange(range);
            Transforms.select(editor, range);
            ReactEditor.focus(editor);
        } else {
            setFoundRange(null);
            alert('No matches found.');
        }
    }, [search, editor, foundRange]);

    const handleReplace = () => {
        if (foundRange) {
            Transforms.insertText(editor, replace, { at: foundRange });
            setFoundRange(null);
        }
    };

    const handleReplaceAll = () => {
        if (!search) return;
        let count = 0;
        for (const [node, path] of Editor.nodes(editor, { at: [], match: n => Text.isText(n) })) {
            if (Text.isText(node)) {
                const { text } = node;
                const lowerText = text.toLowerCase();
                const lowerSearch = search.toLowerCase();
                let index = lowerText.indexOf(lowerSearch);
                while (index !== -1) {
                    const range = { 
                        anchor: { path, offset: index }, 
                        focus: { path, offset: index + search.length }
                    };
                    Transforms.insertText(editor, replace, { at: range });
                    count++;
                    index = text.toLowerCase().indexOf(search.toLowerCase(), index + replace.length);
                }
            }
        }
        alert(`Replaced ${count} instance(s).`);
    };

    return (
        <div className="relative">
            <button onClick={() => setShow(!show)} className="p-2 rounded bg-white text-black hover:bg-gray-200"><Icon icon="find" /></button>
            {show && (
                <div className="absolute top-10 right-0 bg-white p-4 rounded shadow-lg z-20">
                    <div className="flex flex-col space-y-2">
                        <input type="text" placeholder="Find" value={search} onChange={e => setSearch(e.target.value)} className="p-1 rounded border border-gray-300 bg-white text-gray-900" />                        <button onClick={handleFind} className="p-2 rounded bg-gray-200 hover:bg-gray-300">Find</button>
                        <input type="text" placeholder="Replace" value={replace} onChange={e => setReplace(e.target.value)} className="p-1 rounded border border-gray-300 bg-white text-gray-900" />                        <button onClick={handleReplace} className="p-2 rounded bg-gray-200 hover:bg-gray-300">Replace</button>
                        <button onClick={handleReplaceAll} className="p-2 rounded bg-gray-200 hover:bg-gray-300">Replace All</button>
                        <button onClick={() => setShow(false)} className="p-2 rounded bg-gray-200 hover:bg-gray-300">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Theme and Template Configuration ---
interface ThemeSpec {
    background: string;
    text: string;
    editorBackground: string;
    editorText: string;
    toolbar: string;
}

interface CustomTheme extends ThemeSpec {
    backgroundImage: string;
}

const themes: Record<string, ThemeSpec> = {
    light: {
        background: 'bg-gray-100',
        text: 'text-gray-800',
        editorBackground: 'bg-white',
        editorText: 'text-black',
        toolbar: 'bg-white',
    },
    dark: {
        background: 'bg-gray-900',
        text: 'text-white',
        editorBackground: 'bg-gray-800',
        editorText: 'text-white',
        toolbar: 'bg-gray-800',
    },
    // Colorful themes pair a bright backdrop with a frosted DARK toolbar so the
    // ribbon's white icons/text stay readable (the old translucent-white bars
    // had almost no contrast).
    sepia: {
        background: 'bg-amber-50',
        text: 'text-stone-800',
        editorBackground: 'bg-amber-50',
        editorText: 'text-stone-800',
        toolbar: 'bg-amber-200',
    },
    ocean: {
        background: 'bg-gradient-to-br from-sky-500 to-teal-500',
        text: 'text-white',
        editorBackground: 'bg-white',
        editorText: 'text-black',
        toolbar: 'bg-sky-950/80',
    },
    sunset: {
        background: 'bg-gradient-to-br from-orange-500 to-pink-600',
        text: 'text-white',
        editorBackground: 'bg-white',
        editorText: 'text-black',
        toolbar: 'bg-rose-950/80',
    },
    forest: {
        background: 'bg-gradient-to-br from-emerald-500 to-lime-600',
        text: 'text-white',
        editorBackground: 'bg-white',
        editorText: 'text-black',
        toolbar: 'bg-emerald-950/80',
    },
    lavender: {
        background: 'bg-gradient-to-br from-violet-500 to-indigo-600',
        text: 'text-white',
        editorBackground: 'bg-white',
        editorText: 'text-black',
        toolbar: 'bg-indigo-950/80',
    },
    custom: {
        background: '',
        text: '',
        editorBackground: '',
        editorText: '',
        toolbar: '',
    }
};

const templates = {
    'Blank': [{ type: 'paragraph', children: [{ text: '' }] }],
    'Software Spec': [
        { type: 'heading-one', align: 'left', children: [{ text: 'Software Requirements Specification', fontFamily: 'Helvetica', fontSize: 24, bold: true }] },
        { type: 'paragraph', children: [{ text: 'Project Name: ', bold: true, fontFamily: 'Helvetica' }, { text: '[Insert App/Project Name]', fontFamily: 'Helvetica', color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: 'Version: ', bold: true, fontFamily: 'Helvetica' }, { text: '1.0.0', fontFamily: 'Helvetica' }] },
        { type: 'horizontal-rule', children: [{ text: '' }] },
        { type: 'table-of-contents', children: [{ text: '' }] },
        { type: 'heading-two', children: [{ text: '1. Overview', fontFamily: 'Helvetica', fontSize: 18, bold: true }] },
        { type: 'paragraph', children: [{ text: 'A brief description of the software, its purpose, and the target audience. Define the problem this application solves.', fontFamily: 'Helvetica' }] },
        { type: 'heading-two', children: [{ text: '2. System Architecture', fontFamily: 'Helvetica', fontSize: 18, bold: true }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'Frontend:', bold: true }, { text: ' [e.g., React, Tailwind]' }] }] },
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'Backend:', bold: true }, { text: ' [e.g., Node.js, Express]' }] }] },
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'Database:', bold: true }, { text: ' [e.g., PostgreSQL, MongoDB]' }] }] }
        ]},
        { type: 'heading-two', children: [{ text: '3. Core Features', fontFamily: 'Helvetica', fontSize: 18, bold: true }] },
        { type: 'numbered-list', children: [
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'User Authentication (OAuth2)' }] }] },
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'Real-time data synchronization' }] }] },
        ]},
        { type: 'heading-two', children: [{ text: '4. Security & Compliance', fontFamily: 'Helvetica', fontSize: 18, bold: true }] },
        { type: 'paragraph', children: [{ text: 'Detail data encryption at rest and in transit, plus any relevant standards.', fontFamily: 'Helvetica' }] },
        { type: 'heading-two', children: [{ text: '5. Milestones', fontFamily: 'Helvetica', fontSize: 18, bold: true }] },
        { type: 'table', children: [
            { type: 'table-row', children: [
                { type: 'table-cell', header: true, backgroundColor: '#f3f4f6', children: [{ text: 'Milestone', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#f3f4f6', children: [{ text: 'Owner', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#f3f4f6', children: [{ text: 'Target', bold: true }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: 'MVP feature-complete' }] },
                { type: 'table-cell', children: [{ text: '' }] },
                { type: 'table-cell', children: [{ text: '' }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: 'Beta release' }] },
                { type: 'table-cell', children: [{ text: '' }] },
                { type: 'table-cell', children: [{ text: '' }] },
            ]},
        ]},
    ],
    'Business Memo': [
        { type: 'heading-one', align: 'center', children: [{ text: 'MEMORANDUM', fontFamily: 'Arial', fontSize: 24, bold: true, tracking: 'widest' }] },
        { type: 'horizontal-rule', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'TO: ', bold: true, fontFamily: 'Arial' }, { text: '[Recipient Name/Team]', fontFamily: 'Arial' }] },
        { type: 'paragraph', children: [{ text: 'FROM: ', bold: true, fontFamily: 'Arial' }, { text: '[Your Name/Title]', fontFamily: 'Arial' }] },
        { type: 'paragraph', children: [{ text: 'DATE: ', bold: true, fontFamily: 'Arial' }, { text: new Date().toLocaleDateString(), fontFamily: 'Arial' }] },
        { type: 'paragraph', children: [{ text: 'SUBJECT: ', bold: true, fontFamily: 'Arial' }, { text: '[Clear, concise subject line]', fontFamily: 'Arial' }] },
        { type: 'horizontal-rule', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'I. Summary', bold: true, fontFamily: 'Arial', fontSize: 14 }] },
        { type: 'paragraph', children: [{ text: 'State the purpose of this memo directly. What is the issue, and what action is required?', fontFamily: 'Arial' }] },
        { type: 'paragraph', children: [{ text: 'II. Background / Context', bold: true, fontFamily: 'Arial', fontSize: 14 }] },
        { type: 'paragraph', children: [{ text: 'Provide the necessary context for the decision or update. Keep it strictly professional and fact-based.', fontFamily: 'Arial' }] },
        { type: 'paragraph', children: [{ text: 'III. Action Items', bold: true, fontFamily: 'Arial', fontSize: 14 }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: '[Action item 1]' }] }] },
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: '[Action item 2]' }] }] }
        ]},
    ],
    'MLA Style': [
        { type: 'paragraph', align: 'left', lineHeight: 2, children: [{ text: '[Your Name]', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'paragraph', align: 'left', lineHeight: 2, children: [{ text: '[Instructor Name]', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'paragraph', align: 'left', lineHeight: 2, children: [{ text: '[Course Name]', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'paragraph', align: 'left', lineHeight: 2, children: [{ text: '[Date]', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'paragraph', align: 'center', lineHeight: 2, children: [{ text: 'Title of Paper', fontFamily: 'Times New Roman', fontSize: 12, bold: true }] },
        { type: 'paragraph', align: 'left', indent: 1, lineHeight: 2, children: [{ text: 'Start typing your paper here. The paper should be double-spaced. Press tab to indent new paragraphs.', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'page-break', children: [{ text: '' }] },
        { type: 'heading-one', align: 'center', children: [{ text: 'Works Cited', fontFamily: 'Times New Roman', fontSize: 12, bold: true }] },
        { type: 'paragraph', align: 'left', lineHeight: 2, children: [{ text: '[Author Last Name], [First Name]. "', fontFamily: 'Times New Roman', fontSize: 12, hangingIndent: true }, { text: 'Title of Source', italic: true, fontFamily: 'Times New Roman', fontSize: 12 }, { text: '." Publisher, Year.', fontFamily: 'Times New Roman', fontSize: 12 }] },
    ],
    'Résumé': [
        { type: 'heading-one', align: 'center', children: [{ text: '[FIRSTNAME] [LASTNAME]', bold: true, fontFamily: 'Helvetica', fontSize: 28 }] },
        { type: 'paragraph', align: 'center', children: [{ text: 'City, State | Phone | Email | LinkedIn/Portfolio', fontFamily: 'Helvetica', fontSize: 11, color: '#4b5563' }] },
        { type: 'horizontal-rule', children: [{ text: '' }] },
        { type: 'heading-two', children: [{ text: 'PROFESSIONAL SUMMARY', fontFamily: 'Helvetica', bold: true, fontSize: 14 }] },
        { type: 'paragraph', children: [{ text: 'A highly motivated professional with experience in [Field/Industry]. Proven track record of delivering high-quality results, optimizing workflows, and driving project success. Strong technical background combined with excellent communication skills.', fontFamily: 'Helvetica', fontSize: 11 }] },
        { type: 'heading-two', children: [{ text: 'EXPERIENCE', fontFamily: 'Helvetica', bold: true, fontSize: 14 }] },
        { type: 'paragraph', children: [{ text: 'Company Name', bold: true, fontFamily: 'Helvetica', fontSize: 12 }, { text: ' — City, State', fontFamily: 'Helvetica', fontSize: 11 }] },
        { type: 'paragraph', children: [{ text: 'Job Title', italic: true, fontFamily: 'Helvetica', fontSize: 11 }, { text: ' (Month Year – Present)', fontFamily: 'Helvetica', fontSize: 11, color: '#6b7280' }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'Spearheaded the development of [Project], resulting in a 20% increase in efficiency.', fontFamily: 'Helvetica', fontSize: 11 }] }] },
            { type: 'list-item', children: [{ type: 'paragraph', children: [{ text: 'Collaborated with cross-functional teams to identify and resolve critical system bugs.', fontFamily: 'Helvetica', fontSize: 11 }] }] }
        ]},
        { type: 'heading-two', children: [{ text: 'EDUCATION', fontFamily: 'Helvetica', bold: true, fontSize: 14 }] },
        { type: 'paragraph', children: [{ text: 'University Name', bold: true, fontFamily: 'Helvetica', fontSize: 12 }, { text: ' — City, State', fontFamily: 'Helvetica', fontSize: 11 }] },
        { type: 'paragraph', children: [{ text: 'Degree in [Field of Study]', italic: true, fontFamily: 'Helvetica', fontSize: 11 }, { text: ' (Expected Grad Year)', fontFamily: 'Helvetica', fontSize: 11, color: '#6b7280' }] },
        { type: 'heading-two', children: [{ text: 'SKILLS', fontFamily: 'Helvetica', bold: true, fontSize: 14 }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ text: 'Technical: ', bold: true, fontFamily: 'Helvetica', fontSize: 11 }, { text: '[Languages, tools, frameworks]', fontFamily: 'Helvetica', fontSize: 11 }] },
            { type: 'list-item', children: [{ text: 'Professional: ', bold: true, fontFamily: 'Helvetica', fontSize: 11 }, { text: '[Leadership, communication, domain expertise]', fontFamily: 'Helvetica', fontSize: 11 }] },
        ]},
    ],
    'Academic Essay': [
        { type: 'heading-one', align: 'center', children: [{ text: '[Essay Title]', fontFamily: 'Times New Roman', fontSize: 18, bold: true }] },
        { type: 'paragraph', align: 'center', children: [{ text: '[Your Name] — [Course] — [Date]', fontFamily: 'Times New Roman', fontSize: 12, color: '#6b7280' }] },
        { type: 'table-of-contents', children: [{ text: '' }] },
        { type: 'heading-two', children: [{ text: 'Introduction', fontFamily: 'Times New Roman', fontSize: 14, bold: true }] },
        { type: 'paragraph', indent: 1, lineHeight: 2, children: [{ text: 'Open with context and narrow to your thesis statement. The final sentence of this paragraph should state your argument plainly.', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'heading-two', children: [{ text: 'Body', fontFamily: 'Times New Roman', fontSize: 14, bold: true }] },
        { type: 'paragraph', indent: 1, lineHeight: 2, children: [{ text: 'Each paragraph should advance one claim, supported by evidence and a citation.', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'heading-two', children: [{ text: 'Conclusion', fontFamily: 'Times New Roman', fontSize: 14, bold: true }] },
        { type: 'paragraph', indent: 1, lineHeight: 2, children: [{ text: 'Restate the thesis in light of the evidence and close with the broader significance.', fontFamily: 'Times New Roman', fontSize: 12 }] },
        { type: 'page-break', children: [{ text: '' }] },
        { type: 'heading-two', align: 'center', children: [{ text: 'References', fontFamily: 'Times New Roman', fontSize: 14, bold: true }] },
        { type: 'paragraph', lineHeight: 2, hangingIndent: true, children: [{ text: '[Author]. ([Year]). ', fontFamily: 'Times New Roman', fontSize: 12 }, { text: 'Title of work', italic: true, fontFamily: 'Times New Roman', fontSize: 12 }, { text: '. Publisher.', fontFamily: 'Times New Roman', fontSize: 12 }] },
    ],
    'Business Letter': [
        { type: 'paragraph', children: [{ text: '[Your Name]', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '[Street Address]', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '[City, State ZIP]', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: '[Recipient Name]', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '[Title, Company]', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '[Company Address]', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'Dear [Recipient Name],', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: 'State the purpose of your letter in the opening sentence. Keep the first paragraph short and direct.', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: 'Use the middle paragraphs to provide supporting detail — the facts, dates, and specifics the recipient needs in order to act.', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: 'Close by stating the action you are requesting and how you can be reached.', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'Sincerely,', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: '[Your Name]', fontFamily: 'Georgia', fontSize: 12 }] },
    ],
    'Novel Chapter': [
        { type: 'heading-one', align: 'center', children: [{ text: 'Chapter One', fontFamily: 'Garamond', fontSize: 22 }] },
        { type: 'paragraph', align: 'center', children: [{ text: '[Chapter Subtitle — optional]', italic: true, fontFamily: 'Garamond', fontSize: 13, color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', indent: 1, lineHeight: 1.5, children: [{ text: 'The opening line earns the reader’s attention. Begin in motion — in a scene, not a summary.', fontFamily: 'Garamond', fontSize: 13 }] },
        { type: 'paragraph', indent: 1, lineHeight: 1.5, children: [{ text: 'Indent each new paragraph and keep the prose 1.5-spaced for comfortable drafting. Use the horizontal rule below to mark a scene break.', fontFamily: 'Garamond', fontSize: 13 }] },
        { type: 'horizontal-rule', children: [{ text: '' }] },
        { type: 'paragraph', indent: 1, lineHeight: 1.5, children: [{ text: 'A new scene begins here.', fontFamily: 'Garamond', fontSize: 13 }] },
    ],
    'Meeting Notes': [
        { type: 'heading-one', children: [{ text: 'Meeting Notes', fontFamily: 'Helvetica', fontSize: 24, bold: true }] },
        { type: 'paragraph', children: [{ text: 'Date: ', bold: true, fontFamily: 'Helvetica' }, { text: new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), fontFamily: 'Helvetica' }] },
        { type: 'paragraph', children: [{ text: 'Attendees: ', bold: true, fontFamily: 'Helvetica' }, { text: '[Names]', fontFamily: 'Helvetica', color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: 'Facilitator: ', bold: true, fontFamily: 'Helvetica' }, { text: '[Name]', fontFamily: 'Helvetica', color: '#6b7280' }] },
        { type: 'horizontal-rule', children: [{ text: '' }] },
        { type: 'heading-two', children: [{ text: 'Agenda', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'numbered-list', children: [
            { type: 'list-item', children: [{ text: '[Agenda item 1]' }] },
            { type: 'list-item', children: [{ text: '[Agenda item 2]' }] },
            { type: 'list-item', children: [{ text: '[Agenda item 3]' }] },
        ]},
        { type: 'heading-two', children: [{ text: 'Discussion', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ text: '[Key point or decision]' }] },
            { type: 'list-item', children: [{ text: '[Key point or decision]' }] },
        ]},
        { type: 'heading-two', children: [{ text: 'Action Items', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'table', children: [
            { type: 'table-row', children: [
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', children: [{ text: 'Owner', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', children: [{ text: 'Action', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', children: [{ text: 'Due', bold: true }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: '' }] },
                { type: 'table-cell', children: [{ text: '' }] },
                { type: 'table-cell', children: [{ text: '' }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: '' }] },
                { type: 'table-cell', children: [{ text: '' }] },
                { type: 'table-cell', children: [{ text: '' }] },
            ]},
        ]},
        { type: 'heading-two', children: [{ text: 'Next Meeting', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'paragraph', children: [{ text: '[Date, time, and location]', fontFamily: 'Helvetica', color: '#6b7280' }] },
    ],
    'Project Proposal': [
        { type: 'heading-one', align: 'center', children: [{ text: '[Project Name]', fontFamily: 'Helvetica', fontSize: 26, bold: true }] },
        { type: 'paragraph', align: 'center', children: [{ text: 'Prepared by [Name] — ', fontFamily: 'Helvetica', fontSize: 12, color: '#6b7280' }, { text: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), fontFamily: 'Helvetica', fontSize: 12, color: '#6b7280' }] },
        { type: 'table-of-contents', children: [{ text: '' }] },
        { type: 'heading-two', children: [{ text: 'Executive Summary', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'paragraph', children: [{ text: 'One paragraph: the problem, the proposed solution, and the expected impact. Write this last.', fontFamily: 'Helvetica' }] },
        { type: 'heading-two', children: [{ text: 'Goals', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ text: '[Measurable goal 1]' }] },
            { type: 'list-item', children: [{ text: '[Measurable goal 2]' }] },
        ]},
        { type: 'heading-two', children: [{ text: 'Timeline', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'table', children: [
            { type: 'table-row', children: [
                { type: 'table-cell', header: true, backgroundColor: '#dcfce7', children: [{ text: 'Phase', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dcfce7', children: [{ text: 'Deliverable', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dcfce7', children: [{ text: 'Target Date', bold: true }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: 'Discovery' }] },
                { type: 'table-cell', children: [{ text: '[Deliverable]' }] },
                { type: 'table-cell', children: [{ text: '[Date]' }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: 'Build' }] },
                { type: 'table-cell', children: [{ text: '[Deliverable]' }] },
                { type: 'table-cell', children: [{ text: '[Date]' }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: 'Launch' }] },
                { type: 'table-cell', children: [{ text: '[Deliverable]' }] },
                { type: 'table-cell', children: [{ text: '[Date]' }] },
            ]},
        ]},
        { type: 'heading-two', children: [{ text: 'Budget', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'paragraph', children: [{ text: 'Summarize the costs and what each buys. Attach detail as needed.', fontFamily: 'Helvetica' }] },
        { type: 'heading-two', children: [{ text: 'Risks & Mitigations', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'bulleted-list', children: [
            { type: 'list-item', children: [{ text: '[Risk]', bold: true }, { text: ' — [mitigation]' }] },
        ]},
    ],
    'Invoice': [
        { type: 'heading-one', align: 'right', children: [{ text: 'INVOICE', fontFamily: 'Helvetica', fontSize: 30, bold: true, color: '#1d4ed8' }] },
        { type: 'paragraph', align: 'right', children: [{ text: 'Invoice #: [0001]   Date: ', fontFamily: 'Helvetica', fontSize: 11 }, { text: new Date().toLocaleDateString(), fontFamily: 'Helvetica', fontSize: 11 }] },
        { type: 'paragraph', children: [{ text: 'From: ', bold: true, fontFamily: 'Helvetica' }, { text: '[Your Name / Company, Address, Email]', fontFamily: 'Helvetica', color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: 'Bill To: ', bold: true, fontFamily: 'Helvetica' }, { text: '[Client Name, Company, Address]', fontFamily: 'Helvetica', color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'table', children: [
            { type: 'table-row', children: [
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', width: 320, children: [{ text: 'Description', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', children: [{ text: 'Qty', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', children: [{ text: 'Rate', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#dbeafe', children: [{ text: 'Amount', bold: true }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: '[Service or item]' }] },
                { type: 'table-cell', children: [{ text: '1' }] },
                { type: 'table-cell', children: [{ text: '$0.00' }] },
                { type: 'table-cell', children: [{ text: '$0.00' }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', children: [{ text: '[Service or item]' }] },
                { type: 'table-cell', children: [{ text: '1' }] },
                { type: 'table-cell', children: [{ text: '$0.00' }] },
                { type: 'table-cell', children: [{ text: '$0.00' }] },
            ]},
            { type: 'table-row', children: [
                { type: 'table-cell', colSpan: 3, backgroundColor: '#f3f4f6', children: [{ text: 'Total', bold: true }] },
                { type: 'table-cell', backgroundColor: '#f3f4f6', children: [{ text: '$0.00', bold: true }] },
            ]},
        ]},
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'Payment Terms: ', bold: true, fontFamily: 'Helvetica', fontSize: 11 }, { text: 'Due within 30 days. [Payment instructions / bank details]', fontFamily: 'Helvetica', fontSize: 11, color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: 'Thank you for your business.', italic: true, fontFamily: 'Helvetica', fontSize: 11 }] },
    ],
    'Cover Letter': [
        { type: 'paragraph', align: 'right', children: [{ text: '[Your Name]', bold: true, fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', align: 'right', children: [{ text: '[Email] • [Phone] • [City, State]', fontFamily: 'Georgia', fontSize: 11, color: '#6b7280' }] },
        { type: 'paragraph', children: [{ text: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'Dear [Hiring Manager / Name],', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: 'Open with the role you are applying for and one sentence on why you are an unusually good fit. Lead with your strongest, most specific claim.', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: 'In the middle paragraph, connect one or two concrete accomplishments to the needs in the job description. Numbers beat adjectives: ship dates, growth, savings.', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: 'Close by stating your enthusiasm and availability for a conversation, and thank the reader for their time.', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '' }] },
        { type: 'paragraph', children: [{ text: 'Sincerely,', fontFamily: 'Georgia', fontSize: 12 }] },
        { type: 'paragraph', children: [{ text: '[Your Name]', bold: true, fontFamily: 'Georgia', fontSize: 12 }] },
    ],
    'Weekly Planner': [
        { type: 'heading-one', align: 'center', children: [{ text: 'Weekly Planner', fontFamily: 'Helvetica', fontSize: 24, bold: true }] },
        { type: 'paragraph', align: 'center', children: [{ text: 'Week of ', fontFamily: 'Helvetica', color: '#6b7280' }, { text: '[date]', fontFamily: 'Helvetica', color: '#6b7280' }] },
        { type: 'table', children: [
            { type: 'table-row', children: [
                { type: 'table-cell', header: true, backgroundColor: '#ede9fe', width: 140, children: [{ text: 'Day', bold: true }] },
                { type: 'table-cell', header: true, backgroundColor: '#ede9fe', children: [{ text: 'Top Priorities', bold: true }] },
            ]},
            ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
                type: 'table-row',
                children: [
                    { type: 'table-cell', backgroundColor: '#f9fafb', children: [{ text: day, bold: true }] },
                    { type: 'table-cell', children: [{ text: '' }] },
                ],
            })),
        ]},
        { type: 'heading-two', children: [{ text: 'Notes', fontFamily: 'Helvetica', fontSize: 16, bold: true }] },
        { type: 'paragraph', children: [{ text: '' }] },
    ],
};

const templateDescriptions: Record<string, string> = {
    'Blank': 'An empty page. Start from nothing.',
    'Software Spec': 'Requirements doc with architecture, features, and milestones.',
    'Business Memo': 'Internal memo with summary, context, and action items.',
    'MLA Style': 'Double-spaced academic paper with a Works Cited page.',
    'Résumé': 'Clean one-page résumé with experience and education.',
    'Academic Essay': 'Essay scaffold with a live table of contents and references.',
    'Business Letter': 'Formal letter in block format, dated today.',
    'Novel Chapter': 'Manuscript-style chapter with scene-break rules.',
    'Meeting Notes': 'Agenda, discussion, and an action-item tracker table.',
    'Project Proposal': 'Pitch with goals, timeline table, budget, and risks.',
    'Invoice': 'Billing table with totals and payment terms.',
    'Cover Letter': 'Three-paragraph application letter that gets to the point.',
    'Weekly Planner': 'Seven-day priority grid plus a notes section.',
};

const CustomThemeCreator = ({ customTheme, onCustomThemeChange }: { customTheme: CustomTheme, onCustomThemeChange: (theme: CustomTheme) => void }) => {
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onCustomThemeChange({ ...customTheme, backgroundImage: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const clearBackgroundImage = () => {
        onCustomThemeChange({ ...customTheme, backgroundImage: '' });
    };

    return (
        <div className="mt-4">
            <h3 className="text-md font-bold">Custom Theme</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col">
                    <label className="block text-sm font-medium">Background</label>
                    <div className="relative mt-1">
                        <input type="color" value={customTheme.background} onChange={e => onCustomThemeChange({...customTheme, background: e.target.value, backgroundImage: ''})} className="w-full h-10 p-1 border border-gray-300 rounded-md appearance-none" />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: customTheme.background }}></span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="block text-sm font-medium">Text</label>
                    <div className="relative mt-1">
                        <input type="color" value={customTheme.text} onChange={e => onCustomThemeChange({...customTheme, text: e.target.value})} className="w-full h-10 p-1 border border-gray-300 rounded-md appearance-none" />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: customTheme.text }}></span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="block text-sm font-medium">Editor Background</label>
                    <div className="relative mt-1">
                        <input type="color" value={customTheme.editorBackground} onChange={e => onCustomThemeChange({...customTheme, editorBackground: e.target.value})} className="w-full h-10 p-1 border border-gray-300 rounded-md appearance-none" />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: customTheme.editorBackground }}></span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="block text-sm font-medium">Editor Text</label>
                    <div className="relative mt-1">
                        <input type="color" value={customTheme.editorText} onChange={e => onCustomThemeChange({...customTheme, editorText: e.target.value})} className="w-full h-10 p-1 border border-gray-300 rounded-md appearance-none" />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: customTheme.editorText }}></span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="block text-sm font-medium">Toolbar</label>
                    <div className="relative mt-1">
                        <input type="color" value={customTheme.toolbar} onChange={e => onCustomThemeChange({...customTheme, toolbar: e.target.value})} className="w-full h-10 p-1 border border-gray-300 rounded-md appearance-none" />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: customTheme.toolbar }}></span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="block text-sm font-medium">Background Image</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <span>Upload a file</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </div>
                    </div>
                    {customTheme.backgroundImage && (
                        <div className="relative w-full h-20 mt-2">
                            <img src={customTheme.backgroundImage} alt="Background Preview" className="w-full h-full object-cover rounded" />
                            <button onClick={clearBackgroundImage} className="absolute top-1 right-1 text-xs bg-red-500 text-white rounded-full p-1">&times;</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const SettingsModal = ({ currentTheme, onThemeChange, onClose, customTheme, onCustomThemeChange }: { currentTheme: string, onThemeChange: (theme: string) => void, onClose: () => void, customTheme: any, onCustomThemeChange: any }) => {
    return (
        <Modal onClose={onClose}>
            <h2 className="text-lg font-bold">Settings</h2>
            <div className="mt-4">
                <label className="block mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                    {Object.keys(themes).map(themeName => (
                        <button 
                            key={themeName} 
                            onClick={() => onThemeChange(themeName)} 
                            className={`p-4 rounded border-2 ${themeName === currentTheme ? 'border-blue-500' : 'border-transparent'}`}>
                            <div className={`w-full h-8 rounded ${themes[themeName].background} ${themes[themeName].toolbar}`}></div>
                            <span className="text-sm capitalize">{themeName}</span>
                        </button>
                    ))}
                </div>
                {currentTheme === 'custom' && (
                    <CustomThemeCreator customTheme={customTheme} onCustomThemeChange={onCustomThemeChange} />
                )}
            </div>
        </Modal>
    );
}

const TemplateModal = ({ onApply, onClose }: { onApply: (template: Descendant[], name: string) => void, onClose: () => void }) => {
    return (
        <Modal onClose={onClose}>
            <h2 className="text-lg font-bold">New Document</h2>
            <p className="text-sm text-gray-500 mt-1">Start from a blank page or a template.</p>
            <div className="grid grid-cols-2 gap-3 mt-4 max-h-96 overflow-y-auto pr-1">
                {Object.keys(templates).map(templateName => (
                    <button
                        key={templateName}
                        onClick={() => onApply(templates[templateName as keyof typeof templates] as Descendant[], templateName)}
                        className="p-3 rounded border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 text-left"
                    >
                        <span className="block text-base font-medium">{templateName}</span>
                        {templateDescriptions[templateName] && (
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{templateDescriptions[templateName]}</span>
                        )}
                    </button>
                ))}
            </div>
        </Modal>
    );
};

const NewButton = ({ onNew }: { onNew: () => void }) => {
    return <button title="New" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); onNew(); }}><Icon icon="new" /></button>;
}

const computeStats = (nodes: Descendant[]): { wordCount: number, charCount: number } => {
    let wordCount = 0;
    let charCount = 0;
    for (const node of nodes) {
        if (SlateElement.isElement(node)) {
            const text = Node.string(node);
            wordCount += (text.match(/\S+/g) || []).length;
            charCount += text.length;
        }
    }
    return { wordCount, charCount };
};

// --- Toast notifications -------------------------------------------------
type ToastType = 'info' | 'success' | 'error';
interface ToastAction { label: string; onClick: () => void; }
interface ToastItem { id: number; message: string; type: ToastType; action?: ToastAction; duration: number; }

const toastListeners = new Set<(t: ToastItem) => void>();
let toastSeq = 0;
const toast = (message: string, opts: { type?: ToastType; action?: ToastAction; duration?: number } = {}): void => {
    const item: ToastItem = {
        id: ++toastSeq,
        message,
        type: opts.type ?? 'info',
        action: opts.action,
        duration: opts.duration ?? 4000,
    };
    toastListeners.forEach(listener => listener(item));
};

const TOAST_STYLES: Record<ToastType, string> = {
    info: 'bg-gray-900 border-gray-700',
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
};

const Toaster = () => {
    const [items, setItems] = useState<ToastItem[]>([]);
    const dismiss = useCallback((id: number) => setItems(prev => prev.filter(i => i.id !== id)), []);
    useEffect(() => {
        const add = (t: ToastItem) => {
            setItems(prev => [...prev, t]);
            if (t.duration > 0) window.setTimeout(() => dismiss(t.id), t.duration);
        };
        toastListeners.add(add);
        return () => { toastListeners.delete(add); };
    }, [dismiss]);

    return ReactDOM.createPortal(
        <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end space-y-2 print:hidden">
            {items.map(t => (
                <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border text-white text-sm max-w-sm animate-[fadeIn_120ms_ease-out] ${TOAST_STYLES[t.type]}`}
                >
                    <span className="flex-1">{t.message}</span>
                    {t.action && (
                        <button
                            onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                            className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 font-medium whitespace-nowrap"
                        >
                            {t.action.label}
                        </button>
                    )}
                    <button onClick={() => dismiss(t.id)} className="text-white/70 hover:text-white" aria-label="Dismiss">✕</button>
                </div>
            ))}
        </div>,
        document.body
    );
};

// Fast, centralized replacement for the browser's slow native `title` tooltip
// (~500ms). Reads the `title` of any hovered element, suppresses the native
// bubble by stashing the attribute, and shows a custom one after ~120ms.
const FastTooltip = () => {
    const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
    const timer = useRef<number | null>(null);
    const stash = useRef<{ el: HTMLElement; title: string } | null>(null);

    useEffect(() => {
        const findTitled = (start: EventTarget | null): HTMLElement | null => {
            let el = start as HTMLElement | null;
            while (el && el !== document.body) {
                if (el.getAttribute && el.getAttribute('title')) return el;
                el = el.parentElement;
            }
            return null;
        };
        const clear = () => {
            if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
            if (stash.current) { stash.current.el.setAttribute('title', stash.current.title); stash.current = null; }
            setTip(null);
        };
        const onOver = (e: MouseEvent) => {
            const el = findTitled(e.target);
            if (!el) return;
            const title = el.getAttribute('title');
            if (!title) return;
            stash.current = { el, title };
            el.removeAttribute('title'); // suppress the native tooltip
            if (timer.current) window.clearTimeout(timer.current);
            const rect = el.getBoundingClientRect();
            timer.current = window.setTimeout(() => {
                setTip({ text: title, x: rect.left + rect.width / 2, y: rect.bottom + 6 });
            }, 120);
        };
        const onOut = (e: MouseEvent) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (stash.current && !stash.current.el.contains(e.relatedTarget as any)) clear();
        };
        document.addEventListener('mouseover', onOver, true);
        document.addEventListener('mouseout', onOut, true);
        document.addEventListener('mousedown', clear, true);
        window.addEventListener('blur', clear);
        return () => {
            document.removeEventListener('mouseover', onOver, true);
            document.removeEventListener('mouseout', onOut, true);
            document.removeEventListener('mousedown', clear, true);
            window.removeEventListener('blur', clear);
            clear();
        };
    }, []);

    if (!tip) return null;
    return ReactDOM.createPortal(
        <div
            className="fixed z-[60] px-2 py-1 text-xs rounded bg-gray-900 text-white shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: tip.x, top: tip.y, transform: 'translateX(-50%)' }}
        >
            {tip.text}
        </div>,
        document.body
    );
};

const DONATE_URL = 'https://buy.stripe.com/8x2aEWa7w0Vh0SUdte6oo01';

// A tip-jar nudge: animates open on launch (icon → "Donate" → icon), re-opens on
// hover, and opens a gentle ask before sending the user to Stripe.
const DonateButton = () => {
    const [showModal, setShowModal] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const openT = window.setTimeout(() => setExpanded(true), 900);
        const closeT = window.setTimeout(() => setExpanded(false), 3800);
        return () => { window.clearTimeout(openT); window.clearTimeout(closeT); };
    }, []);

    const donate = () => {
        window.api.openExternal(DONATE_URL).catch(() => { /* main unavailable */ });
        setShowModal(false);
    };

    return (
        <>
            <button
                title="Support Scribe"
                aria-label="Support Scribe"
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
                onClick={() => setShowModal(true)}
                className="relative flex items-center overflow-hidden rounded-full px-2 py-2 text-pink-600 dark:text-pink-400 bg-pink-500/10 hover:bg-pink-500/15 border border-pink-400/30 backdrop-blur-sm shadow-sm transition-colors"
            >
                <DonateIcon />
                {/* grid 0fr -> 1fr animates to the label's natural width perfectly
                    smoothly (no max-width snap, no margin jump). */}
                <span className={`grid transition-[grid-template-columns] duration-500 ease-in-out ${expanded ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'}`}>
                    <span className="overflow-hidden">
                        <span className="block whitespace-nowrap pl-1.5 pr-0.5 text-sm font-medium">Donate</span>
                    </span>
                </span>
                {/* glassy shine sweep, delayed so it fires once the pill is open */}
                {expanded && (
                    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                        <span
                            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                            style={{ animation: 'shine 850ms ease-in-out 360ms 1' }}
                        />
                    </span>
                )}
            </button>
            {showModal && (
                <Modal onClose={() => setShowModal(false)}>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">💛</span>
                        <h2 className="text-lg font-bold">Support Scribe</h2>
                    </div>
                    <p className="my-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        Free apps still cost us money and time to build. Show some appreciation and love for our
                        time with a small donation. We carry on the love by donating 10% of all company profits to
                        charities.
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Eh, nevermind</button>
                        <button onClick={donate} className="px-4 py-2 rounded bg-pink-500 text-white hover:bg-pink-600 font-medium">Donate now</button>
                    </div>
                </Modal>
            )}
        </>
    );
};

const BLANK_DOC: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }] }];

// --- Main App Component ---
const App = () => {
    const editor = useMemo(() => withHistory(withPlugins(withReact(createEditor()))), []);
    const [activeTab, setActiveTab] = useState('Home');
    const initialValue = useMemo<Descendant[]>(() => JSON.parse(JSON.stringify(BLANK_DOC)), []);
    const [stats, setStats] = useState({ wordCount: 0, charCount: 0 });
    const statsTimer = useRef<number | null>(null);
    const dirtyRef = useRef(false);
    const [_, forceRender] = useState(0);
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('theme') || 'light';
        } catch (e) {
            return 'light';
        }
    });
    const [showSettings, setShowSettings] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [customTheme, setCustomTheme] = useState(() => {
        const saved = localStorage.getItem('customTheme');
        return saved ? JSON.parse(saved) : {
            background: '#ffffff',
            text: '#000000',
            editorBackground: '#ffffff',
            editorText: '#000000',
            toolbar: '#f3f4f6',
            backgroundImage: '',
        };
    });

    useEffect(() => {
        localStorage.setItem('customTheme', JSON.stringify(customTheme));
    }, [customTheme]);

    useEffect(() => {
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
        }
    }, [theme]);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        return () => {
            root.classList.remove('dark');
        };
    }, [theme]);

    // --- Document lifecycle ---
    const markSaved = useCallback(() => {
        dirtyRef.current = false;
        window.api.setDirty(false).catch(() => { /* main process unavailable */ });
    }, []);

    const handleEditorChange = useCallback(() => {
        const contentChanged = editor.operations.some(op => op.type !== 'set_selection');
        if (!contentChanged) return;
        if (!dirtyRef.current) {
            dirtyRef.current = true;
            window.api.setDirty(true).catch(() => { /* main process unavailable */ });
        }
        if (statsTimer.current !== null) window.clearTimeout(statsTimer.current);
        statsTimer.current = window.setTimeout(() => setStats(computeStats(editor.children)), 250);
    }, [editor]);

    const loadContent = useCallback((newValue: Descendant[]) => {
        editor.selection = null;
        editor.children = newValue;
        editor.history = { redos: [], undos: [] };
        Editor.normalize(editor, { force: true });
        setStats(computeStats(editor.children));
        markSaved();
        forceRender(c => c + 1);
    }, [editor, markSaved]);

    const openDocument = useCallback(async () => {
        if (dirtyRef.current && !window.confirm('You have unsaved changes. Open another document anyway?')) return;
        const result = await window.api.openFile();
        if (!result.success) {
            if (!result.canceled) alert(`Could not open file: ${result.error}`);
            return;
        }
        try {
            let newValue: Descendant[];
            if (result.fileType === 'html-import') {
                const parsedHtml = new DOMParser().parseFromString(String(result.content), 'text/html');
                const slateNodes = deserializeHtml(parsedHtml.body, {});
                newValue = Array.isArray(slateNodes) ? slateNodes : [slateNodes];
            } else {
                newValue = (typeof result.content === 'string' ? JSON.parse(result.content) : result.content) as Descendant[];
            }
            if (!Array.isArray(newValue) || newValue.length === 0) newValue = JSON.parse(JSON.stringify(BLANK_DOC));
            loadContent(newValue);
            if (result.fileName?.toLowerCase().endsWith('.pdf')) {
                toast('PDF imported (beta) — text and layout are reconstructed, so review formatting. Save As to keep it as .docx or .scribe.', { type: 'info', duration: 8000 });
            }
        } catch (err) {
            alert(`Error parsing file content: ${(err as Error).message}`);
        }
    }, [loadContent]);

    const saveDocument = useCallback(async (saveAs = false) => {
        const content = editor.children;
        const result = saveAs ? await window.api.saveAsFile(content) : await window.api.saveFile(content);
        if (result.success) markSaved();
        else if (!result.canceled) alert(`Error saving file: ${result.error}`);
    }, [editor, markSaved]);

    const exportPdf = useCallback(async () => {
        const result = await window.api.exportPdf(editor.children);
        if (!result.success && !result.canceled) alert(`Error exporting to PDF: ${result.error}`);
    }, [editor]);

    const newDocument = useCallback(() => {
        if (dirtyRef.current && !window.confirm('You have unsaved changes. Start a new document anyway?')) return;
        setShowTemplateModal(true);
    }, []);

    const applyTemplate = useCallback(async (template: Descendant[]) => {
        await window.api.newDocument().catch(() => { /* main process unavailable */ });
        // Deep-clone so editing never mutates the template definition itself.
        loadContent(JSON.parse(JSON.stringify(template)));
        setShowTemplateModal(false);
        setTimeout(() => {
            try { ReactEditor.focus(editor); } catch { /* not mounted yet */ }
        }, 0);
    }, [editor, loadContent]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const mod = isMac ? e.metaKey : e.ctrlKey;
            if (!mod) return;

            const key = e.key.toLowerCase();

            if (key === 'b') {
                e.preventDefault();
                toggleMark(editor, 'bold');
            } else if (key === 'i') {
                e.preventDefault();
                toggleMark(editor, 'italic');
            } else if (key === 'u') {
                e.preventDefault();
                toggleMark(editor, 'underline');
            } else if (key === 's') {
                e.preventDefault();
                saveDocument(e.shiftKey);
            } else if (key === 'o') {
                e.preventDefault();
                openDocument();
            } else if (key === 'n') {
                e.preventDefault();
                newDocument();
            } else if (key === 'p') {
                e.preventDefault();
                window.print();
            } else if (key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    HistoryEditor.redo(editor);
                } else {
                    HistoryEditor.undo(editor);
                }
            } else if (key === 'y') {
                e.preventDefault();
                HistoryEditor.redo(editor);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [editor, saveDocument, openDocument, newDocument]);

    // Surface auto-update progress as toasts; the "downloaded" toast stays until
    // the user restarts to apply it.
    useEffect(() => {
        if (!window.api?.onUpdateStatus) return;
        return window.api.onUpdateStatus(({ status }) => {
            if (status === 'available') {
                toast('Update found — downloading in the background…', { type: 'info' });
            } else if (status === 'downloaded') {
                toast('A new version of Scribe is ready.', {
                    type: 'success',
                    duration: 0,
                    action: { label: 'Restart now', onClick: () => window.api.restartToUpdate() },
                });
            }
        });
    }, []);

    const renderLeaf = useCallback((props: any) => <MemoizedLeaf {...props} />, []);
    const renderElement = useCallback((props: any) => <MemoizedElement {...props} />, []);

    const mainStyle: React.CSSProperties = theme === 'custom' ? {
        backgroundImage: customTheme.backgroundImage ? `url(${customTheme.backgroundImage})` : 'none',
        backgroundColor: customTheme.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: customTheme.text,
    } : {};

    const editorStyle: React.CSSProperties = theme === 'custom' ? {
        backgroundColor: customTheme.editorBackground,
        color: customTheme.editorText,
    } : {};

    const toolbarStyle: React.CSSProperties = theme === 'custom' ? {
        backgroundColor: customTheme.toolbar,
    } : {};

    return (
        <Slate editor={editor} initialValue={initialValue} onChange={handleEditorChange}>
            <ErrorBoundary>
            <Toaster />
            <FastTooltip />
            <FloatingToolbar />
            <TableToolbar />
            <div className={`${theme !== 'custom' ? themes[theme].background : ''} ${theme !== 'custom' ? themes[theme].text : ''} min-h-screen flex flex-col`} style={mainStyle}>
                
                <div className={`print:hidden ${theme !== 'custom' ? themes[theme].toolbar : ''} shadow-md sticky top-0 z-10`} style={toolbarStyle}>
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center">
                            <span className="pl-4 pr-3 text-lg font-bold tracking-tight select-none">✒️ Scribe</span>
                            <RibbonTab title="File" active={activeTab === 'File'} onClick={() => setActiveTab('File')} />
                            <RibbonTab title="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} />
                            <RibbonTab title="Insert" active={activeTab === 'Insert'} onClick={() => setActiveTab('Insert')} />
                            <RibbonTab title="References" active={activeTab === 'References'} onClick={() => setActiveTab('References')} />
                        </div>
                            <div className="p-2 flex items-center space-x-2">
                                <DonateButton />
                                <button title="Toggle Theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Toggle theme">
                                    {theme === 'dark' ? '🌙' : '☀️'}
                                </button>
                                <button onClick={() => setShowSettings(true)} aria-label="Open settings"><Icon icon="settings" /></button>
                            </div>
                    </div>
                    {activeTab === 'File' && (
                        <div className="flex items-center flex-wrap">
                            <ToolbarSection>
                                <CutButton /><CopyButton /><PasteButton />
                            </ToolbarSection>
                             <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection>
                                <NewButton onNew={newDocument} />
                                <button title="Templates" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700`} onMouseDown={e => { e.preventDefault(); setShowTemplateModal(true); }}><Icon icon="template" /></button>
                                <OpenButton onOpen={openDocument} />
                                <SaveButton onSave={() => saveDocument(false)} />
                                <SaveAsButton onSaveAs={() => saveDocument(true)} />
                                <PrintButton />
                                <ExportButton onExport={exportPdf} />
                                <ShareButton editor={editor} />
                                <ContactButton />
                                <InfoButton />
                                <CloseButton />
                            </ToolbarSection>
                        </div>
                    )}
                    {activeTab === 'Home' && (
                        <div className="flex items-center flex-wrap">
                            <ToolbarSection><button title="Undo" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${editor.history.undos.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} onMouseDown={() => HistoryEditor.undo(editor)} disabled={editor.history.undos.length === 0}><Icon icon="undo" /></button><button title="Redo" className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${editor.history.redos.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} onMouseDown={() => HistoryEditor.redo(editor)} disabled={editor.history.redos.length === 0}><Icon icon="redo" /></button></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><Dropdown mark="fontFamily" options={FONT_FACES} placeholder="Font" /><Dropdown mark="fontSize" options={FONT_SIZES} placeholder="Size" /><IncreaseFontSizeButton /><DecreaseFontSizeButton /></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><div className="flex flex-col space-y-1"><ColorPicker mark="color" colors={TEXT_COLORS} /><ColorPicker mark="backgroundColor" colors={HIGHLIGHT_COLORS} /></div></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><MarkButton format="bold" icon="bold" /><MarkButton format="italic" icon="italic" /><MarkButton format="underline" icon="underline" /><MarkButton format="strikethrough" icon="strikethrough" /><MarkButton format="code" icon="code" /><MarkButton format="superscript" icon="superscript" /><MarkButton format="subscript" icon="subscript" /><ClearFormattingButton /></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><LinkButton /><BlockButton format="block-quote" icon="quote" /></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><BlockButton format="heading-one" icon="h1" /><BlockButton format="heading-two" icon="h2" /><BlockButton format="heading-three" icon="h3" /></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><BlockButton format="numbered-list" icon="numbered_list" /><BlockButton format="bulleted-list" icon="bulleted_list" /><IndentButton action="outdent" /><IndentButton action="indent" /></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><BlockButton format="left" icon="align_left" /><BlockButton format="center" icon="align_center" /><BlockButton format="right" icon="align_right" /><BlockButton format="justify" icon="align_justify" /><LineSpacingDropdown /></ToolbarSection>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                            <ToolbarSection><FindReplace editor={editor} /></ToolbarSection>
                        </div>
                    )}
                    {activeTab === 'Insert' && (
                        <div className="flex items-center flex-wrap">
                            <ToolbarSection>
                                <InsertImageButton />
                                <InsertHorizontalRuleButton />
                                <InsertPageBreakButton />
                                <InsertTableButton />
                                <TableStyleDropdown options={TABLE_STYLES} placeholder="Table Style" />
                                
                                <InsertRowButton editor={editor} />
                                <DeleteRowButton editor={editor} />
                                <InsertColumnButton editor={editor} />
                                <DeleteColumnButton editor={editor} />
                                <InsertSymbolButton />
                                <InsertIconButton />
                            </ToolbarSection>
                        </div>
                    )}
                    {activeTab === 'References' && (
                        <div className="flex items-center flex-wrap">
                            <ToolbarSection><InsertFootnoteButton /><InsertCitationButton /><InsertTocButton /></ToolbarSection>
                        </div>
                    )}
                </div>
                
                {showSettings && <SettingsModal currentTheme={theme} onThemeChange={setTheme} onClose={() => setShowSettings(false)} customTheme={customTheme} onCustomThemeChange={setCustomTheme} />}
                {showTemplateModal && <TemplateModal onApply={applyTemplate} onClose={() => setShowTemplateModal(false)} />}
                
                <div className={`flex-grow overflow-y-auto p-4 sm:p-8 md:p-12 print:p-0 print:overflow-visible ${theme !== 'custom' ? themes[theme].background : ''}`} onClick={() => ReactEditor.focus(editor)}>
                    <style>{`
                        @media print {
                            .page {
                                background-color: white !important;
                                color: black !important;
                            }
                        }
                    `}</style>
                    <div className={`page ${theme === 'dark' ? 'dark' : ''} ${theme !== 'custom' ? themes[theme].editorText : ''}`} style={editorStyle}>
                        <Editable
                            className="outline-none printable"
                            placeholder="Enter some text..."
                            renderElement={renderElement}
                            renderLeaf={renderLeaf}
                            spellCheck={true}
                        />
                    </div>
                </div>
                
                <StatusBar wordCount={stats.wordCount} charCount={stats.charCount} theme={theme} themes={themes} customTheme={customTheme} />
            </div>
            </ErrorBoundary>
        </Slate>
    );
};

export default App;