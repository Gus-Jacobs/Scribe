import { BaseEditor } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

export type AlignType = 'left' | 'center' | 'right' | 'justify';

/** Props shared by every text-bearing block. */
export interface BlockProps {
  align?: AlignType;
  indent?: number;
  lineHeight?: number;
  hangingIndent?: boolean;
}

// Void elements still carry a text child (Slate requirement); its content is ignored.
export type EmptyText = { text: string };

// --- Inline elements ---
export type LinkElement = { type: 'link'; url: string; children: CustomText[] };
export type FootnoteElement = { type: 'footnote'; number: number; children: EmptyText[] };
export type CitationElement = { type: 'citation'; children: CustomText[] };
export type IconElement = { type: 'icon'; icon: string; children: EmptyText[] };

export type InlineElement = LinkElement | FootnoteElement | CitationElement | IconElement;
export type InlineDescendant = CustomText | InlineElement;

// --- Blocks ---
export type ParagraphElement = { type: 'paragraph'; children: InlineDescendant[] } & BlockProps;
export type HeadingOneElement = { type: 'heading-one'; id?: string; children: InlineDescendant[] } & BlockProps;
export type HeadingTwoElement = { type: 'heading-two'; id?: string; children: InlineDescendant[] } & BlockProps;
export type HeadingThreeElement = { type: 'heading-three'; id?: string; children: InlineDescendant[] } & BlockProps;
export type BlockQuoteElement = { type: 'block-quote'; children: InlineDescendant[] } & BlockProps;

export type ListItemElement = { type: 'list-item'; children: (InlineDescendant | CustomElement)[] } & BlockProps;
export type BulletedListElement = { type: 'bulleted-list'; children: ListItemElement[] } & BlockProps;
export type NumberedListElement = { type: 'numbered-list'; children: ListItemElement[] } & BlockProps;

export type ImageElement = {
  type: 'image';
  url: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  children: EmptyText[];
};
export type HorizontalRuleElement = { type: 'horizontal-rule'; children: EmptyText[] };
export type PageBreakElement = { type: 'page-break'; children: EmptyText[] };

export type FootnoteContentElement = { type: 'footnote-content'; number: number; children: InlineDescendant[] };
export type FootnoteContainerElement = { type: 'footnote-container'; children: FootnoteContentElement[] };

export type TableCellElement = {
  type: 'table-cell';
  width?: number;
  colSpan?: number;
  rowSpan?: number;
  backgroundColor?: string;
  header?: boolean;
  children: (InlineDescendant | CustomElement)[];
};
export type TableRowElement = { type: 'table-row'; height?: number; children: TableCellElement[] };
export type TableElement = { type: 'table'; tableStyle?: 'plain' | 'striped'; children: TableRowElement[] };

/** Void block; its content is derived live from the document's headings. */
export type TableOfContentsElement = { type: 'table-of-contents'; children: EmptyText[] };

export type CustomElement =
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement
  | BlockQuoteElement
  | BulletedListElement
  | NumberedListElement
  | ListItemElement
  | LinkElement
  | ImageElement
  | HorizontalRuleElement
  | PageBreakElement
  | FootnoteElement
  | CitationElement
  | IconElement
  | FootnoteContainerElement
  | FootnoteContentElement
  | TableElement
  | TableRowElement
  | TableCellElement
  | TableOfContentsElement;

export type CustomElementType = CustomElement['type'];

export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  superscript?: boolean;
  subscript?: boolean;
  /** Internal: renders the leaf as an anchor (used by generated TOC text). */
  link?: string;
};

export type MarkFormat = keyof Omit<CustomText, 'text'>;

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
