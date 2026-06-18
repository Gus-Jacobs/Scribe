import { Editor, Element as SlateElement, Range, Transforms } from 'slate';
import { AlignType, CustomElement, CustomElementType, LinkElement, MarkFormat } from '../CustomTypes';

/** Shared mark/block formatting commands (used by the ribbon and the floating toolbar). */

export const LIST_TYPES: CustomElementType[] = ['numbered-list', 'bulleted-list'];
export const TEXT_ALIGN_TYPES = ['left', 'center', 'right', 'justify'];

export const isMarkActive = (editor: Editor, format: MarkFormat): boolean => {
  try {
    const marks = Editor.marks(editor);
    return marks ? !!marks[format] : false;
  } catch {
    return false;
  }
};

export const toggleMark = (editor: Editor, format: MarkFormat): void => {
  if (isMarkActive(editor, format)) Editor.removeMark(editor, format);
  else Editor.addMark(editor, format, true);
};

export const addMarkData = (editor: Editor, format: MarkFormat, data: string | number): void => {
  Editor.addMark(editor, format, data);
};

export const isBlockActive = (
  editor: Editor,
  format: string,
  blockType: 'type' | 'align' = 'type'
): boolean => {
  const { selection } = editor;
  if (!selection) return false;
  const [match] = Editor.nodes(editor, {
    at: Editor.unhangRange(editor, selection),
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as unknown as Record<string, unknown>)[blockType] === format,
  });
  return !!match;
};

export const toggleBlock = (editor: Editor, format: string): void => {
  const isAlign = TEXT_ALIGN_TYPES.includes(format);
  const isActive = isBlockActive(editor, format, isAlign ? 'align' : 'type');
  const isList = LIST_TYPES.includes(format as CustomElementType);

  Transforms.unwrapNodes(editor, {
    match: n =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && LIST_TYPES.includes(n.type) && !isAlign,
    split: true,
  });

  let newProperties: Partial<SlateElement>;
  if (isAlign) {
    newProperties = { align: isActive ? undefined : (format as AlignType) };
  } else {
    newProperties = {
      type: isActive ? 'paragraph' : isList ? 'list-item' : (format as CustomElementType),
    } as Partial<SlateElement>;
  }
  Transforms.setNodes<SlateElement>(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format, children: [] } as unknown as CustomElement;
    Transforms.wrapNodes(editor, block);
  }
};

export const isLinkActive = (editor: Editor): boolean => {
  const [link] = Editor.nodes(editor, {
    match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
  });
  return !!link;
};

export const unwrapLink = (editor: Editor): void => {
  Transforms.unwrapNodes(editor, {
    match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
  });
};

/**
 * Insert a link with an optional custom display text.
 * - Collapsed selection: drops in a link reading `text` (or the URL).
 * - Expanded selection with matching/blank text: wraps the selection.
 * - Expanded selection with new text: replaces the selection with the link.
 */
export const insertLink = (editor: Editor, url: string, text?: string): void => {
  if (!url) return;
  if (isLinkActive(editor)) unwrapLink(editor);
  if (!editor.selection) Transforms.select(editor, Editor.end(editor, []));

  const { selection } = editor;
  const label = text && text.trim() !== '' ? text : url;
  const isCollapsed = !selection || Range.isCollapsed(selection);

  if (isCollapsed) {
    const link: LinkElement = { type: 'link', url, children: [{ text: label }] };
    Transforms.insertNodes(editor, link);
    return;
  }

  const current = Editor.string(editor, selection);
  if (text && text.trim() !== '' && text !== current) {
    Transforms.delete(editor);
    const link: LinkElement = { type: 'link', url, children: [{ text: label }] };
    Transforms.insertNodes(editor, link);
  } else {
    const link: LinkElement = { type: 'link', url, children: [] };
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: 'end' });
  }
};

export const wrapLink = (editor: Editor, url: string): void => {
  if (isLinkActive(editor)) unwrapLink(editor);
  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link: LinkElement = { type: 'link', url, children: isCollapsed ? [{ text: url }] : [] };
  if (isCollapsed) {
    Transforms.insertNodes(editor, link);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: 'end' });
  }
};
