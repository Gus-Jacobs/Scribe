import {
  CustomElement,
  CustomText,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
  TableCellElement,
  TableElement,
} from '../CustomTypes';

/**
 * Slate -> HTML serializer (the export half of the HTML-Bridge Pipeline).
 * The output feeds html-to-docx, the .html exporter, and Pandoc (.odt/.rtf),
 * so everything must be expressed as inline styles on plain HTML.
 */

type SlateNode = CustomElement | CustomText;
type HeadingElement = HeadingOneElement | HeadingTwoElement | HeadingThreeElement;

export interface SerializeOptions {
  /**
   * html-to-docx has gaps the DOCX path must work around:
   * - <hr> and paragraph borders are dropped → emit a glyph line instead
   *   (the importer converts it back).
   * - text-indent is unsupported → hanging indents are emitted as a sentinel
   *   margin-left that the main process rewrites into a real w:hanging.
   * - max-width on images breaks explicit width parsing → omit it.
   */
  docx?: boolean;
}

const HR_GLYPH_LINE = '─'.repeat(36);

/**
 * 41px = 615 twips: an otherwise-never-occurring indent value used to mark
 * hanging-indent paragraphs inside the generated DOCX. Rewritten by
 * applyDocxFixups into `<w:ind w:left="720" w:hanging="720"/>`.
 */
export const HANGING_INDENT_SENTINEL_PX = 41;
export const HANGING_INDENT_SENTINEL_TWIPS = HANGING_INDENT_SENTINEL_PX * 15;

const HEADING_LEVELS: Record<string, number> = {
  'heading-one': 1,
  'heading-two': 2,
  'heading-three': 3,
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isText = (node: SlateNode): node is CustomText => (node as CustomText).text !== undefined;

const cssSize = (value: string | number | undefined): string | undefined => {
  if (value === undefined || value === '' || value === 'auto') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

const serializeText = (node: CustomText): string => {
  let text = escapeHtml(node.text).replace(/\n/g, '<br />');

  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.underline) text = `<u>${text}</u>`;
  if (node.strikethrough) text = `<del>${text}</del>`;
  if (node.superscript) text = `<sup>${text}</sup>`;
  if (node.subscript) text = `<sub>${text}</sub>`;
  if (node.code) text = `<code style="font-family: 'Courier New', monospace;">${text}</code>`;

  let style = '';
  if (node.color) style += `color: ${node.color};`;
  if (node.backgroundColor) style += `background-color: ${node.backgroundColor};`;
  if (node.fontSize) style += `font-size: ${node.fontSize}px;`;
  if (node.fontFamily) style += `font-family: '${node.fontFamily}';`;

  return style ? `<span style="${escapeHtml(style)}">${text}</span>` : text;
};

const blockStyle = (node: CustomElement, opts: SerializeOptions): string => {
  const el = node as CustomElement & {
    align?: string;
    indent?: number;
    lineHeight?: number;
    hangingIndent?: boolean;
  };
  let style = '';
  if (el.align) style += `text-align: ${el.align};`;
  if (el.hangingIndent) {
    style += opts.docx
      ? `margin-left: ${HANGING_INDENT_SENTINEL_PX}px;`
      : 'padding-left: 2em; text-indent: -2em;';
  } else if (el.indent) {
    style += `margin-left: ${el.indent * 40}px;`;
  }
  if (el.lineHeight) style += `line-height: ${el.lineHeight};`;
  return style ? ` style="${escapeHtml(style)}"` : '';
};

const collectHeadings = (nodes: SlateNode[], out: HeadingElement[] = []): HeadingElement[] => {
  for (const node of nodes) {
    if (isText(node)) continue;
    if (node.type in HEADING_LEVELS) out.push(node as HeadingElement);
    else if ('children' in node) collectHeadings(node.children as SlateNode[], out);
  }
  return out;
};

const plainText = (node: SlateNode): string => {
  if (isText(node)) return node.text;
  return (node.children as SlateNode[]).map(plainText).join('');
};

const serializeToc = (doc: SlateNode[]): string => {
  const headings = collectHeadings(doc).filter(h => plainText(h).trim() !== '');
  if (headings.length === 0) return '';
  const entries = headings
    .map(h => {
      const level = HEADING_LEVELS[h.type];
      const indent = (level - 1) * 24;
      return `<p style="margin: 2px 0 2px ${indent}px;">${escapeHtml(plainText(h))}</p>`;
    })
    .join('');
  return `<div><h2>Table of Contents</h2>${entries}</div>`;
};

const serializeCell = (cell: TableCellElement, serializeChildren: () => string): string => {
  const tag = cell.header ? 'th' : 'td';
  let style = 'border: 1px solid #999999; padding: 6px; vertical-align: top;';
  if (cell.backgroundColor) style += `background-color: ${cell.backgroundColor};`;
  if (cell.width) style += `width: ${cell.width}px;`;
  const span =
    (cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '') +
    (cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '');
  return `<${tag}${span} style="${escapeHtml(style)}">${serializeChildren()}</${tag}>`;
};

const serializeNode = (
  node: SlateNode,
  doc: SlateNode[],
  opts: SerializeOptions,
  table?: TableElement,
  rowIndex?: number
): string => {
  if (isText(node)) return serializeText(node);

  const children = () =>
    (node.children as SlateNode[]).map(child => serializeNode(child, doc, opts, table, rowIndex)).join('');
  const styleAttr = blockStyle(node, opts);

  switch (node.type) {
    case 'heading-one':
      return `<h1${styleAttr}>${children()}</h1>`;
    case 'heading-two':
      return `<h2${styleAttr}>${children()}</h2>`;
    case 'heading-three':
      return `<h3${styleAttr}>${children()}</h3>`;
    case 'block-quote':
      return `<blockquote style="border-left: 4px solid #cccccc; margin-left: 0; padding-left: 16px; font-style: italic;">${children()}</blockquote>`;
    case 'bulleted-list':
      return `<ul${styleAttr}>${children()}</ul>`;
    case 'numbered-list':
      return `<ol${styleAttr}>${children()}</ol>`;
    case 'list-item':
      return `<li${styleAttr}>${children()}</li>`;
    case 'link':
      return `<a href="${escapeHtml(node.url)}">${children()}</a>`;
    case 'image': {
      const width = cssSize(node.width);
      const height = cssSize(node.height);
      // max-width breaks html-to-docx's explicit-width parsing; only emit it
      // for browser-rendered targets (HTML/PDF/Pandoc).
      let style = opts.docx ? '' : 'max-width: 100%;';
      if (width) style += `width: ${width};`;
      if (height && height !== 'auto') style += `height: ${height};`;
      const alt = node.alt ? ` alt="${escapeHtml(node.alt)}"` : '';
      const styleAttrStr = style ? ` style="${escapeHtml(style)}"` : '';
      return `<img src="${escapeHtml(node.url)}"${alt}${styleAttrStr} />`;
    }
    case 'horizontal-rule':
      return opts.docx
        ? `<p style="text-align: center;"><span style="color: #999999;">${HR_GLYPH_LINE}</span></p>`
        : '<hr />';
    case 'page-break':
      // html-to-docx and printToPDF both honor this CSS page-break marker.
      return '<div class="page-break" style="page-break-after: always;"></div>';
    case 'table': {
      const rows = node.children
        .map((row, i) => serializeNode(row, doc, opts, node, i))
        .join('');
      return `<table style="border-collapse: collapse; width: 100%;">${rows}</table>`;
    }
    case 'table-row':
      return `<tr>${node.children
        .map(cell => {
          // Striped tables are a UI style; bake it into the export.
          const striped = table?.tableStyle === 'striped' && rowIndex !== undefined && rowIndex % 2 === 1;
          const cellNode: TableCellElement =
            striped && !cell.backgroundColor ? { ...cell, backgroundColor: '#f3f4f6' } : cell;
          return serializeCell(cellNode, () =>
            (cellNode.children as SlateNode[]).map(c => serializeNode(c, doc, opts)).join('')
          );
        })
        .join('')}</tr>`;
    case 'table-of-contents':
      return serializeToc(doc);
    case 'footnote':
      return `<sup>[${node.number}]</sup>`;
    case 'footnote-content':
      return `<p style="font-size: 12px;">${node.number}. ${children()}</p>`;
    case 'footnote-container':
      return `<div><hr />${children()}</div>`;
    case 'citation':
      return `<span>(${children()})</span>`;
    case 'icon':
      // Lucide icons are UI-only; exports drop them rather than emitting markup
      // that Word cannot render.
      return '';
    case 'table-cell':
      // Reached only if a cell appears outside a row; serialize its content.
      return children();
    case 'paragraph':
    default:
      return `<p${styleAttr}>${children()}</p>`;
  }
};

export const generateHtmlString = (
  nodes: SlateNode[],
  title = 'Document',
  opts: SerializeOptions = {}
): string => {
  const body = nodes.map(node => serializeNode(node, nodes, opts)).join('');
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    `<title>${escapeHtml(title)}</title>` +
    '<style>body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; }</style>' +
    `</head><body>${body}</body></html>`
  );
};
