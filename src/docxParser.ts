import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import {
  AlignType,
  CustomElement,
  CustomText,
  ListItemElement,
  TableCellElement,
  TableRowElement,
} from './CustomTypes';

/**
 * DOCX -> Slate import.
 *
 * Primary path: parse the OOXML directly (document.xml + rels + numbering +
 * styles + media) so the FULL formatting model survives: fonts, sizes, colors,
 * highlights, alignment, indentation, line spacing, lists, table spans and
 * shading, images, hyperlinks, footnotes, and page breaks. Mammoth's semantic
 * HTML (which deliberately discards visual styling) is kept only as a fallback
 * for files the native parser cannot read.
 *
 * Unit conversions (mirrors of the export pipeline):
 *   w:sz (half-points)  -> pt  = sz / 2
 *   w:ind (twips)       -> indent units = twips / 600   (1 unit = 40px)
 *   w:spacing line      -> lineHeight   = line / 240
 *   wp:extent (EMU)     -> px  = emu / 9525
 *   dxa (twips)         -> px  = dxa / 15
 */

// --- Minimal htmlparser2 DOM typing (cheerio's xmlMode output) ---
interface XmlNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: XmlNode[];
}

type Marks = Partial<Omit<CustomText, 'text'>>;
type InlineItem = CustomText | CustomElement | { pageBreak: true };

interface ParseContext {
  rels: Map<string, string>;
  media: Map<string, string>; // relationship id -> data URI
  numFormats: Map<string, Map<number, string>>; // numId -> ilvl -> numFmt
  styleNames: Map<string, string>; // styleId -> style name
  footnotes: Map<string, CustomText[]>; // footnote id -> content runs
  usedFootnotes: { id: string; number: number }[];
}

const BLANK_PARAGRAPH = (): CustomElement => ({ type: 'paragraph', children: [{ text: '' }] });

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff',
  blue: '#0000ff', red: '#ff0000', darkBlue: '#00008b', darkCyan: '#008b8b',
  darkGreen: '#006400', darkMagenta: '#8b008b', darkRed: '#8b0000',
  darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3',
  black: '#000000', white: '#ffffff',
};

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', emf: 'image/emf',
  wmf: 'image/wmf', tiff: 'image/tiff', tif: 'image/tiff',
};

// --- XML traversal helpers ---
const elements = (node: XmlNode | undefined): XmlNode[] =>
  (node?.children ?? []).filter(c => c.type === 'tag');

const child = (node: XmlNode | undefined, name: string): XmlNode | undefined =>
  elements(node).find(c => c.name === name);

const childAll = (node: XmlNode | undefined, name: string): XmlNode[] =>
  elements(node).filter(c => c.name === name);

const descendant = (node: XmlNode | undefined, name: string): XmlNode | undefined => {
  for (const el of elements(node)) {
    if (el.name === name) return el;
    const found = descendant(el, name);
    if (found) return found;
  }
  return undefined;
};

const attr = (node: XmlNode | undefined, name: string): string | undefined =>
  node?.attribs?.[name];

const val = (node: XmlNode | undefined): string | undefined => attr(node, 'w:val');

const textContent = (node: XmlNode | undefined): string => {
  if (!node) return '';
  if (node.type === 'text') return node.data ?? '';
  return (node.children ?? []).map(textContent).join('');
};

/** OOXML on/off toggles: present means on unless val says otherwise. */
const isOn = (node: XmlNode | undefined): boolean => {
  if (!node) return false;
  const v = val(node);
  return v === undefined || !['0', 'false', 'none', 'off'].includes(v.toLowerCase());
};

const parseXml = (xml: string): XmlNode => {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $.root()[0] as unknown as XmlNode;
};

// --- Run properties -> marks ---
const marksFromRunProps = (rPr: XmlNode | undefined): Marks => {
  const marks: Marks = {};
  if (!rPr) return marks;

  if (isOn(child(rPr, 'w:b'))) marks.bold = true;
  if (isOn(child(rPr, 'w:i'))) marks.italic = true;
  if (isOn(child(rPr, 'w:strike')) || isOn(child(rPr, 'w:dstrike'))) marks.strikethrough = true;

  const u = child(rPr, 'w:u');
  if (u && val(u)?.toLowerCase() !== 'none') marks.underline = true;

  const vertAlign = val(child(rPr, 'w:vertAlign'));
  if (vertAlign === 'superscript') marks.superscript = true;
  if (vertAlign === 'subscript') marks.subscript = true;

  const color = val(child(rPr, 'w:color'));
  if (color && color.toLowerCase() !== 'auto') marks.color = `#${color.toLowerCase()}`;

  const sz = val(child(rPr, 'w:sz'));
  if (sz) {
    // w:sz is half-points; our fontSize is whole points (sz / 2).
    const pt = Math.round(parseInt(sz, 10) / 2);
    if (pt > 0) marks.fontSize = pt;
  }

  const fonts = child(rPr, 'w:rFonts');
  const family = attr(fonts, 'w:ascii') || attr(fonts, 'w:hAnsi') || attr(fonts, 'w:cs');
  if (family) marks.fontFamily = family;

  const highlight = val(child(rPr, 'w:highlight'));
  if (highlight && HIGHLIGHT_COLORS[highlight]) marks.backgroundColor = HIGHLIGHT_COLORS[highlight];
  const shd = child(rPr, 'w:shd');
  const fill = attr(shd, 'w:fill');
  if (!marks.backgroundColor && fill && fill.toLowerCase() !== 'auto') {
    marks.backgroundColor = `#${fill.toLowerCase()}`;
  }

  return marks;
};

// --- Images ---
const resolveImage = (node: XmlNode, ctx: ParseContext): CustomElement | null => {
  const blip = descendant(node, 'a:blip');
  const relId = attr(blip, 'r:embed') || attr(blip, 'r:link') || attr(descendant(node, 'v:imagedata'), 'r:id');
  if (!relId) return null;
  const dataUri = ctx.media.get(relId);
  if (!dataUri) return null;

  const extent = descendant(node, 'wp:extent');
  const cx = parseInt(attr(extent, 'cx') ?? '', 10);
  const cy = parseInt(attr(extent, 'cy') ?? '', 10);

  return {
    type: 'image',
    url: dataUri,
    ...(cx > 0 ? { width: Math.round(cx / 9525) } : {}),
    ...(cy > 0 ? { height: Math.round(cy / 9525) } : {}),
    children: [{ text: '' }],
  };
};

// --- Runs and inline content ---
const parseRun = (run: XmlNode, ctx: ParseContext): InlineItem[] => {
  const marks = marksFromRunProps(child(run, 'w:rPr'));
  const items: InlineItem[] = [];

  for (const el of elements(run)) {
    switch (el.name) {
      case 'w:t':
        items.push({ text: textContent(el), ...marks });
        break;
      case 'w:br':
        if (attr(el, 'w:type') === 'page') items.push({ pageBreak: true });
        else items.push({ text: '\n', ...marks });
        break;
      case 'w:cr':
        items.push({ text: '\n', ...marks });
        break;
      case 'w:tab':
        items.push({ text: '\t', ...marks });
        break;
      case 'w:noBreakHyphen':
        items.push({ text: '-', ...marks });
        break;
      case 'w:drawing':
      case 'w:pict':
      case 'w:object': {
        const image = resolveImage(el, ctx);
        if (image) items.push(image);
        break;
      }
      case 'w:footnoteReference': {
        const id = attr(el, 'w:id');
        if (id && ctx.footnotes.has(id)) {
          const number = ctx.usedFootnotes.length + 1;
          ctx.usedFootnotes.push({ id, number });
          items.push({ type: 'footnote', number, children: [{ text: '' }] } as CustomElement);
        }
        break;
      }
      default:
        break;
    }
  }
  return items;
};

const collectInline = (nodes: XmlNode[], ctx: ParseContext): InlineItem[] => {
  const items: InlineItem[] = [];
  for (const el of nodes) {
    switch (el.name) {
      case 'w:r':
        items.push(...parseRun(el, ctx));
        break;
      case 'w:hyperlink': {
        const relId = attr(el, 'r:id');
        const anchor = attr(el, 'w:anchor');
        const url = (relId && ctx.rels.get(relId)) || (anchor ? `#${anchor}` : '#');
        const inner = collectInline(elements(el), ctx).filter(
          (i): i is CustomText => (i as CustomText).text !== undefined
        );
        if (inner.length > 0) {
          items.push({ type: 'link', url, children: inner } as CustomElement);
        }
        break;
      }
      case 'w:fldSimple': {
        const instr = attr(el, 'w:instr') ?? '';
        const match = instr.match(/HYPERLINK\s+"([^"]+)"/);
        const inner = collectInline(elements(el), ctx);
        if (match) {
          const texts = inner.filter((i): i is CustomText => (i as CustomText).text !== undefined);
          if (texts.length > 0) items.push({ type: 'link', url: match[1], children: texts } as CustomElement);
        } else {
          items.push(...inner);
        }
        break;
      }
      case 'w:ins': // tracked insertion: accept the content
      case 'w:smartTag':
      case 'w:sdt': {
        const content = el.name === 'w:sdt' ? child(el, 'w:sdtContent') : el;
        items.push(...collectInline(elements(content ?? el), ctx));
        break;
      }
      case 'w:del': // tracked deletion: drop
      case 'w:pPr':
      case 'w:proofErr':
      case 'w:bookmarkStart':
      case 'w:bookmarkEnd':
        break;
      default:
        break;
    }
  }
  return items;
};

// --- Paragraphs ---
const ALIGN_MAP: Record<string, AlignType> = {
  center: 'center', right: 'right', end: 'right', both: 'justify',
  distribute: 'justify', justify: 'justify', left: 'left', start: 'left',
};

interface ParsedBlock {
  block: CustomElement;
  list?: { numId: string; ilvl: number };
}

const headingTypeFor = (styleId: string | undefined, ctx: ParseContext): CustomElement['type'] | null => {
  if (!styleId) return null;
  const name = (ctx.styleNames.get(styleId) ?? styleId).toLowerCase().replace(/\s+/g, '');
  if (name === 'title' || name === 'heading1') return 'heading-one';
  if (name === 'subtitle' || name === 'heading2') return 'heading-two';
  if (/^heading[3-9]$/.test(name)) return 'heading-three';
  if (name === 'quote' || name === 'intensequote') return 'block-quote';
  return null;
};

const parseParagraph = (p: XmlNode, ctx: ParseContext): ParsedBlock[] => {
  const pPr = child(p, 'w:pPr');
  const out: ParsedBlock[] = [];

  if (isOn(child(pPr, 'w:pageBreakBefore'))) {
    out.push({ block: { type: 'page-break', children: [{ text: '' }] } });
  }

  // Block-level properties
  const blockProps: Record<string, unknown> = {};
  const jc = val(child(pPr, 'w:jc'));
  if (jc && ALIGN_MAP[jc] && ALIGN_MAP[jc] !== 'left') blockProps.align = ALIGN_MAP[jc];

  const spacing = child(pPr, 'w:spacing');
  const line = parseInt(attr(spacing, 'w:line') ?? '', 10);
  const lineRule = attr(spacing, 'w:lineRule');
  if (line > 0 && (!lineRule || lineRule === 'auto')) {
    const lh = Math.round((line / 240) * 100) / 100;
    if (lh !== 1) blockProps.lineHeight = lh;
  }

  const ind = child(pPr, 'w:ind');
  const left = parseInt(attr(ind, 'w:left') ?? attr(ind, 'w:start') ?? '', 10);
  const hanging = parseInt(attr(ind, 'w:hanging') ?? '', 10);

  // html-to-docx flattens <blockquote> to exactly `ind left=284 + jc both`;
  // recognize that signature and restore the block-quote element.
  const isHtmlBridgeQuote = left === 284 && jc === 'both';
  if (isHtmlBridgeQuote) {
    delete blockProps.align;
  } else if (hanging > 0) {
    blockProps.hangingIndent = true;
  } else if (left > 0) {
    const units = Math.round(left / 600);
    if (units > 0) blockProps.indent = Math.min(units, 12);
  }

  const styleType =
    headingTypeFor(val(child(pPr, 'w:pStyle')), ctx) ?? (isHtmlBridgeQuote ? 'block-quote' : null);

  const numPr = child(pPr, 'w:numPr');
  const numId = val(child(numPr, 'w:numId'));
  const ilvl = parseInt(val(child(numPr, 'w:ilvl')) ?? '0', 10);
  const list = numId && numId !== '0' && !styleType ? { numId, ilvl } : undefined;

  // Word represents a horizontal rule as an empty bordered paragraph.
  const hasBottomBorder = !!child(child(pPr, 'w:pBdr'), 'w:bottom');

  // Inline content (page breaks and images split the paragraph into blocks)
  const inline = collectInline(elements(p), ctx);
  let textRun: (CustomText | CustomElement)[] = [];
  const segments: CustomElement[] = [];

  const flushText = (force = false) => {
    const hasContent = textRun.some(item =>
      (item as CustomText).text !== undefined
        ? (item as CustomText).text !== ''
        : true
    );
    if (hasContent || force) {
      segments.push({
        type: (styleType ?? 'paragraph') as 'paragraph',
        ...blockProps,
        children: textRun.length > 0 ? textRun : [{ text: '' }],
      } as CustomElement);
    }
    textRun = [];
  };

  for (const item of inline) {
    if ((item as { pageBreak?: boolean }).pageBreak) {
      flushText();
      segments.push({ type: 'page-break', children: [{ text: '' }] });
    } else if ((item as CustomElement).type === 'image') {
      flushText();
      segments.push(item as CustomElement);
    } else {
      textRun.push(item as CustomText | CustomElement);
    }
  }
  flushText(segments.length === 0); // an empty paragraph is still a paragraph

  // Convert hr representations back to horizontal-rule
  const finalSegments = segments.map(segment => {
    if (segment.type !== 'paragraph') return segment;
    const text = segment.children.map(c => (c as CustomText).text ?? '').join('');
    const isGlyphRule = /^[─_]{8,}$/.test(text.trim());
    const isBorderRule = hasBottomBorder && text.trim() === '';
    if (isGlyphRule || isBorderRule) {
      return { type: 'horizontal-rule', children: [{ text: '' }] } as CustomElement;
    }
    return segment;
  });

  out.push(...finalSegments.map(block => ({ block, list })));
  return out;
};

// --- Tables ---
const parseTable = (tbl: XmlNode, ctx: ParseContext): CustomElement | null => {
  const trNodes = childAll(tbl, 'w:tr');
  if (trNodes.length === 0) return null;

  interface CellInfo {
    node: XmlNode;
    gridCol: number;
    colSpan: number;
    vMerge: 'restart' | 'continue' | null;
    header: boolean;
  }
  const grid: CellInfo[][] = trNodes.map(tr => {
    const isHeader = isOn(child(child(tr, 'w:trPr'), 'w:tblHeader'));
    let col = 0;
    return childAll(tr, 'w:tc').map(tc => {
      const tcPr = child(tc, 'w:tcPr');
      const spanVal = parseInt(val(child(tcPr, 'w:gridSpan')) ?? '1', 10);
      const colSpan = Number.isFinite(spanVal) && spanVal > 1 ? spanVal : 1;
      const vMergeNode = child(tcPr, 'w:vMerge');
      const vMerge = vMergeNode ? ((val(vMergeNode) ?? 'continue') as 'restart' | 'continue') : null;
      const info: CellInfo = { node: tc, gridCol: col, colSpan, vMerge, header: isHeader };
      col += colSpan;
      return info;
    });
  });

  const rowSpanFor = (rowIdx: number, gridCol: number): number => {
    let span = 1;
    for (let r = rowIdx + 1; r < grid.length; r++) {
      const below = grid[r].find(c => c.gridCol === gridCol);
      if (below && below.vMerge === 'continue') span++;
      else break;
    }
    return span;
  };

  const rows: TableRowElement[] = [];
  for (let r = 0; r < grid.length; r++) {
    const cells: TableCellElement[] = [];
    for (const info of grid[r]) {
      if (info.vMerge === 'continue') continue; // covered by the restart cell above

      const tcPr = child(info.node, 'w:tcPr');
      const fill = attr(child(tcPr, 'w:shd'), 'w:fill');
      const tcW = child(tcPr, 'w:tcW');
      const width =
        attr(tcW, 'w:type') === 'dxa' ? Math.round(parseInt(attr(tcW, 'w:w') ?? '0', 10) / 15) : 0;

      const contentNodes = elements(info.node).filter(n => n.name !== 'w:tcPr');
      let content = parseBlocks(contentNodes, ctx);
      if (content.length === 0) content = [BLANK_PARAGRAPH()];

      const rowSpan = info.vMerge === 'restart' ? rowSpanFor(r, info.gridCol) : 1;

      cells.push({
        type: 'table-cell',
        children: content as TableCellElement['children'],
        ...(info.colSpan > 1 ? { colSpan: info.colSpan } : {}),
        ...(rowSpan > 1 ? { rowSpan } : {}),
        ...(info.header ? { header: true } : {}),
        ...(fill && fill.toLowerCase() !== 'auto' ? { backgroundColor: `#${fill.toLowerCase()}` } : {}),
        ...(width > 0 ? { width } : {}),
      });
    }
    if (cells.length > 0) {
      const trHeight = parseInt(val(child(child(trNodes[r], 'w:trPr'), 'w:trHeight')) ?? '', 10);
      rows.push({
        type: 'table-row',
        children: cells,
        ...(trHeight > 0 ? { height: Math.round(trHeight / 15) } : {}),
      });
    }
  }

  return rows.length > 0 ? { type: 'table', children: rows } : null;
};

// --- Blocks + list grouping ---
const isTocSdt = (sdt: XmlNode): boolean => {
  const gallery = val(descendant(child(sdt, 'w:sdtPr'), 'w:docPartGallery')) ?? '';
  return gallery.toLowerCase().includes('table of contents');
};

const parseBlocks = (nodes: XmlNode[], ctx: ParseContext): CustomElement[] => {
  const parsed: ParsedBlock[] = [];

  for (const el of nodes) {
    switch (el.name) {
      case 'w:p':
        parsed.push(...parseParagraph(el, ctx));
        break;
      case 'w:tbl': {
        const table = parseTable(el, ctx);
        if (table) parsed.push({ block: table });
        break;
      }
      case 'w:sdt': {
        if (isTocSdt(el)) {
          parsed.push({ block: { type: 'table-of-contents', children: [{ text: '' }] } });
        } else {
          const content = child(el, 'w:sdtContent');
          for (const block of parseBlocks(elements(content), ctx)) parsed.push({ block });
        }
        break;
      }
      default:
        break;
    }
  }

  return groupLists(parsed, ctx);
};

const listTypeFor = (numId: string, ilvl: number, ctx: ParseContext): 'bulleted-list' | 'numbered-list' => {
  const fmt = ctx.numFormats.get(numId)?.get(ilvl) ?? ctx.numFormats.get(numId)?.get(0);
  return fmt === 'bullet' ? 'bulleted-list' : 'numbered-list';
};

/** Fold consecutive numbered paragraphs into (possibly nested) list trees. */
const groupLists = (items: ParsedBlock[], ctx: ParseContext): CustomElement[] => {
  const out: CustomElement[] = [];
  // Stack of open lists, one per indentation level.
  let stack: { ilvl: number; list: CustomElement }[] = [];

  const closeAll = () => { stack = []; };

  for (const item of items) {
    if (!item.list || item.block.type !== 'paragraph') {
      closeAll();
      out.push(item.block);
      continue;
    }

    const { numId, ilvl } = item.list;
    const type = listTypeFor(numId, ilvl, ctx);
    const li: ListItemElement = {
      type: 'list-item',
      children: item.block.children as ListItemElement['children'],
    };

    while (stack.length > 0 && stack[stack.length - 1].ilvl > ilvl) stack.pop();

    let top = stack[stack.length - 1];
    if (!top || top.ilvl < ilvl || top.list.type !== type) {
      if (top && top.ilvl < ilvl) {
        // Nest a new list inside the previous list item.
        const parentItems = top.list.children as ListItemElement[];
        const host = parentItems[parentItems.length - 1];
        const nested = { type, children: [] } as unknown as CustomElement;
        (host.children as CustomElement[]).push(nested);
        stack.push({ ilvl, list: nested });
      } else {
        // Sibling list of a different type, or a brand new top-level list.
        if (top && top.ilvl === ilvl) stack.pop();
        const list = { type, children: [] } as unknown as CustomElement;
        if (stack.length === 0) out.push(list);
        else {
          const parentItems = stack[stack.length - 1].list.children as ListItemElement[];
          const host = parentItems[parentItems.length - 1];
          (host.children as CustomElement[]).push(list);
        }
        stack.push({ ilvl, list });
      }
      top = stack[stack.length - 1];
    }
    (top.list.children as ListItemElement[]).push(li);
  }

  return out;
};

// --- Package readers ---
const parseRels = (xml: string | null): Map<string, string> => {
  const rels = new Map<string, string>();
  if (!xml) return rels;
  const root = parseXml(xml);
  const walk = (node: XmlNode) => {
    for (const el of elements(node)) {
      if (el.name === 'Relationship') {
        const id = attr(el, 'Id');
        const target = attr(el, 'Target');
        if (id && target) rels.set(id, target);
      }
      walk(el);
    }
  };
  walk(root);
  return rels;
};

const loadMedia = async (
  zip: JSZip,
  rels: Map<string, string>
): Promise<Map<string, string>> => {
  const media = new Map<string, string>();
  for (const [id, target] of rels) {
    if (!/\.(png|jpe?g|gif|bmp|webp|svg|emf|wmf|tiff?)$/i.test(target)) continue;
    const normalized = target.replace(/^\.\.\//, '').replace(/^\//, '');
    const file = zip.file(`word/${normalized}`) ?? zip.file(normalized);
    if (!file) continue;
    try {
      const base64 = await file.async('base64');
      const ext = (target.split('.').pop() ?? 'png').toLowerCase();
      media.set(id, `data:${IMAGE_MIME[ext] ?? 'image/png'};base64,${base64}`);
    } catch {
      // Unreadable media entry: the image is skipped, the document still loads.
    }
  }
  return media;
};

const parseNumbering = (xml: string | null): Map<string, Map<number, string>> => {
  const result = new Map<string, Map<number, string>>();
  if (!xml) return result;
  const root = parseXml(xml);
  const numbering = descendant(root, 'w:numbering');
  if (!numbering) return result;

  const abstractFormats = new Map<string, Map<number, string>>();
  for (const abstractNum of childAll(numbering, 'w:abstractNum')) {
    const id = attr(abstractNum, 'w:abstractNumId');
    if (!id) continue;
    const levels = new Map<number, string>();
    for (const lvl of childAll(abstractNum, 'w:lvl')) {
      const ilvl = parseInt(attr(lvl, 'w:ilvl') ?? '0', 10);
      const fmt = val(child(lvl, 'w:numFmt'));
      if (fmt) levels.set(ilvl, fmt);
    }
    abstractFormats.set(id, levels);
  }
  for (const num of childAll(numbering, 'w:num')) {
    const numId = attr(num, 'w:numId');
    const abstractId = val(child(num, 'w:abstractNumId'));
    if (numId && abstractId && abstractFormats.has(abstractId)) {
      result.set(numId, abstractFormats.get(abstractId)!);
    }
  }
  return result;
};

const parseStyleNames = (xml: string | null): Map<string, string> => {
  const names = new Map<string, string>();
  if (!xml) return names;
  const root = parseXml(xml);
  const styles = descendant(root, 'w:styles');
  for (const style of childAll(styles, 'w:style')) {
    const id = attr(style, 'w:styleId');
    const name = val(child(style, 'w:name'));
    if (id && name) names.set(id, name);
  }
  return names;
};

const parseFootnotes = (xml: string | null, ctx: ParseContext): void => {
  if (!xml) return;
  const root = parseXml(xml);
  const container = descendant(root, 'w:footnotes');
  for (const footnote of childAll(container, 'w:footnote')) {
    const id = attr(footnote, 'w:id');
    const type = attr(footnote, 'w:type');
    if (!id || type === 'separator' || type === 'continuationSeparator') continue;
    const texts: CustomText[] = [];
    for (const p of childAll(footnote, 'w:p')) {
      for (const item of collectInline(elements(p), ctx)) {
        if ((item as CustomText).text !== undefined) texts.push(item as CustomText);
      }
      texts.push({ text: ' ' });
    }
    while (texts.length > 0 && texts[texts.length - 1].text.trim() === '') texts.pop();
    ctx.footnotes.set(id, texts.length > 0 ? texts : [{ text: '' }]);
  }
};

// --- Native entry point ---
const parseDocxNative = async (buffer: Buffer): Promise<CustomElement[]> => {
  const zip = await JSZip.loadAsync(buffer);
  const read = (path: string): Promise<string | null> =>
    zip.file(path)?.async('string') ?? Promise.resolve(null);

  const documentXml = await read('word/document.xml');
  if (!documentXml) throw new Error('Not a valid DOCX package (word/document.xml missing).');

  const rels = parseRels(await read('word/_rels/document.xml.rels'));
  const ctx: ParseContext = {
    rels,
    media: await loadMedia(zip, rels),
    numFormats: parseNumbering(await read('word/numbering.xml')),
    styleNames: parseStyleNames(await read('word/styles.xml')),
    footnotes: new Map(),
    usedFootnotes: [],
  };
  parseFootnotes(await read('word/footnotes.xml'), ctx);

  const root = parseXml(documentXml);
  const body = descendant(root, 'w:body');
  if (!body) throw new Error('DOCX document has no body.');

  let blocks = parseBlocks(elements(body), ctx);

  // html-to-docx prepends one empty paragraph to every export; trim a single
  // leading blank so our own files do not grow a blank line per round trip.
  if (blocks.length > 1) {
    const first = blocks[0];
    if (
      first.type === 'paragraph' &&
      first.children.length === 1 &&
      (first.children[0] as CustomText).text === ''
    ) {
      blocks = blocks.slice(1);
    }
  }

  // Referenced footnotes become a footnote section at the end of the document.
  if (ctx.usedFootnotes.length > 0) {
    blocks.push({
      type: 'footnote-container',
      children: ctx.usedFootnotes.map(({ id, number }) => ({
        type: 'footnote-content' as const,
        number,
        children: ctx.footnotes.get(id) ?? [{ text: '' }],
      })),
    });
  }

  return blocks.length > 0 ? blocks : [BLANK_PARAGRAPH()];
};

// --- Mammoth fallback (semantic HTML; loses visual styling but very tolerant) ---
const FALLBACK_STYLE_MAP = [
  'u => u',
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "br[type='page'] => hr.page-break",
];

interface DomNode {
  type: string;
  data?: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: DomNode[];
}

type SlateNode = CustomElement | CustomText;

const isCustomText = (n: SlateNode): n is CustomText => (n as CustomText).text !== undefined;
const isInlineNode = (n: SlateNode): boolean =>
  isCustomText(n) || ['link', 'footnote', 'citation', 'icon'].includes((n as CustomElement).type);

const ensureChildren = (nodes: SlateNode[]): SlateNode[] => (nodes.length > 0 ? nodes : [{ text: '' }]);

const htmlMarks = (node: DomNode, inherited: Marks): Marks => {
  const marks: Marks = { ...inherited };
  const tag = node.name?.toLowerCase();
  if (tag === 'strong' || tag === 'b') marks.bold = true;
  if (tag === 'em' || tag === 'i') marks.italic = true;
  if (tag === 'u' || tag === 'ins') marks.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') marks.strikethrough = true;
  if (tag === 'code') marks.code = true;
  if (tag === 'sup') marks.superscript = true;
  if (tag === 'sub') marks.subscript = true;
  return marks;
};

const deserializeHtmlNode = (node: DomNode, inherited: Marks): SlateNode | SlateNode[] | null => {
  if (node.type === 'text') {
    const text = (node.data ?? '').replace(/[\n\r\t]+/g, ' ');
    if (text.trim() === '' && text !== ' ') return null;
    return { text, ...inherited };
  }
  if (node.type !== 'tag') return null;

  const tag = node.name?.toLowerCase() ?? '';
  const marks = htmlMarks(node, inherited);
  const children: SlateNode[] = [];
  for (const c of node.children ?? []) {
    const result = deserializeHtmlNode(c, marks);
    if (Array.isArray(result)) children.push(...result);
    else if (result) children.push(result);
  }

  switch (tag) {
    case 'h1': return { type: 'heading-one', children: ensureChildren(children) } as CustomElement;
    case 'h2': return { type: 'heading-two', children: ensureChildren(children) } as CustomElement;
    case 'h3': case 'h4': case 'h5': case 'h6':
      return { type: 'heading-three', children: ensureChildren(children) } as CustomElement;
    case 'blockquote': return { type: 'block-quote', children: ensureChildren(children) } as CustomElement;
    case 'p': case 'div': return { type: 'paragraph', children: ensureChildren(children) } as CustomElement;
    case 'ul': case 'ol': {
      const items = children.filter((c): c is ListItemElement => !isCustomText(c) && c.type === 'list-item');
      return items.length > 0
        ? ({ type: tag === 'ul' ? 'bulleted-list' : 'numbered-list', children: items } as CustomElement)
        : null;
    }
    case 'li': return { type: 'list-item', children: ensureChildren(children) } as CustomElement;
    case 'a': {
      const url = node.attribs?.href ?? '#';
      const texts = children.filter(isCustomText);
      return { type: 'link', url, children: texts.length > 0 ? texts : [{ text: url }] } as CustomElement;
    }
    case 'img': {
      const src = node.attribs?.src ?? '';
      return src ? ({ type: 'image', url: src, children: [{ text: '' }] } as CustomElement) : null;
    }
    case 'hr':
      return {
        type: (node.attribs?.class ?? '').includes('page-break') ? 'page-break' : 'horizontal-rule',
        children: [{ text: '' }],
      } as CustomElement;
    case 'br': return { text: '\n', ...marks };
    case 'table': {
      const rows = children.filter((c): c is TableRowElement => !isCustomText(c) && c.type === 'table-row');
      return rows.length > 0 ? ({ type: 'table', children: rows } as CustomElement) : null;
    }
    case 'thead': case 'tbody': case 'tfoot': return children;
    case 'tr': {
      const cells = children.filter((c): c is TableCellElement => !isCustomText(c) && c.type === 'table-cell');
      return cells.length > 0 ? ({ type: 'table-row', children: cells } as CustomElement) : null;
    }
    case 'td': case 'th':
      return {
        type: 'table-cell',
        children: ensureChildren(children) as TableCellElement['children'],
        ...(tag === 'th' ? { header: true } : {}),
      } as CustomElement;
    default:
      return children;
  }
};

const parseDocxViaMammoth = async (buffer: Buffer): Promise<CustomElement[]> => {
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer }, { styleMap: FALLBACK_STYLE_MAP });
    html = result.value;
  } catch {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  }

  const $ = cheerio.load(html);
  const body = $('body')[0] as unknown as DomNode;
  const top: SlateNode[] = [];
  for (const node of body?.children ?? []) {
    const result = deserializeHtmlNode(node, {});
    if (Array.isArray(result)) top.push(...result);
    else if (result) top.push(result);
  }

  // Wrap loose inline runs in paragraphs.
  const blocks: CustomElement[] = [];
  let run: SlateNode[] = [];
  const flush = () => {
    if (run.length > 0) {
      blocks.push({ type: 'paragraph', children: run } as CustomElement);
      run = [];
    }
  };
  for (const node of top) {
    if (isInlineNode(node)) run.push(node);
    else { flush(); blocks.push(node as CustomElement); }
  }
  flush();

  return blocks.length > 0 ? blocks : [BLANK_PARAGRAPH()];
};

export const parseDocxToSlate = async (buffer: Buffer): Promise<CustomElement[]> => {
  try {
    return await parseDocxNative(buffer);
  } catch (error) {
    console.error('Native DOCX parser failed, falling back to mammoth:', error);
    return parseDocxViaMammoth(buffer);
  }
};
