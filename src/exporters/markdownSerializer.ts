import { CustomElement, CustomText, ListItemElement, TableRowElement } from '../CustomTypes';

/** Slate -> GitHub-flavored Markdown serializer for .md export. */

type SlateNode = CustomElement | CustomText;

const isText = (node: SlateNode): node is CustomText => (node as CustomText).text !== undefined;

const serializeText = (node: CustomText): string => {
  let text = node.text;
  if (text.trim() === '') return text;
  if (node.code) text = `\`${text}\``;
  if (node.bold && node.italic) text = `***${text}***`;
  else if (node.bold) text = `**${text}**`;
  else if (node.italic) text = `*${text}*`;
  if (node.strikethrough) text = `~~${text}~~`;
  return text;
};

const inline = (nodes: SlateNode[]): string =>
  nodes
    .map(node => {
      if (isText(node)) return serializeText(node);
      switch (node.type) {
        case 'link':
          return `[${inline(node.children as SlateNode[])}](${node.url})`;
        case 'footnote':
          return `[^${node.number}]`;
        case 'citation':
          return `(${inline(node.children as SlateNode[])})`;
        default:
          return 'children' in node ? inline(node.children as SlateNode[]) : '';
      }
    })
    .join('');

const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const cellText = (nodes: SlateNode[]): string =>
  nodes
    .map(node => {
      if (isText(node)) return serializeText(node);
      if ('children' in node) return cellText(node.children as SlateNode[]);
      return '';
    })
    .join('');

const serializeTableRow = (row: TableRowElement): string =>
  `| ${row.children.map(cell => escapeCell(cellText(cell.children as SlateNode[]))).join(' | ')} |`;

const serializeListItem = (item: ListItemElement, marker: string, depth: number): string => {
  const indent = '  '.repeat(depth);
  const inlineParts: SlateNode[] = [];
  const nestedLines: string[] = [];
  for (const child of item.children as SlateNode[]) {
    if (!isText(child) && (child.type === 'bulleted-list' || child.type === 'numbered-list')) {
      nestedLines.push(serializeList(child, depth + 1));
    } else if (!isText(child) && child.type === 'paragraph') {
      inlineParts.push(...(child.children as SlateNode[]));
    } else {
      inlineParts.push(child);
    }
  }
  const lines = [`${indent}${marker} ${inline(inlineParts)}`];
  if (nestedLines.length > 0) lines.push(...nestedLines);
  return lines.join('\n');
};

const serializeList = (
  list: Extract<CustomElement, { type: 'bulleted-list' | 'numbered-list' }>,
  depth: number
): string =>
  list.children
    .map((item, i) =>
      serializeListItem(item, list.type === 'numbered-list' ? `${i + 1}.` : '-', depth)
    )
    .join('\n');

const serializeBlock = (node: CustomElement): string => {
  switch (node.type) {
    case 'heading-one':
      return `# ${inline(node.children as SlateNode[])}`;
    case 'heading-two':
      return `## ${inline(node.children as SlateNode[])}`;
    case 'heading-three':
      return `### ${inline(node.children as SlateNode[])}`;
    case 'block-quote':
      return inline(node.children as SlateNode[])
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
    case 'bulleted-list':
    case 'numbered-list':
      return serializeList(node, 0);
    case 'image':
      return `![${node.alt ?? ''}](${node.url})`;
    case 'horizontal-rule':
      return '---';
    case 'page-break':
      return '---';
    case 'table': {
      const [head, ...rest] = node.children;
      if (!head) return '';
      const cols = head.children.length;
      const lines = [
        serializeTableRow(head),
        `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`,
        ...rest.map(serializeTableRow),
      ];
      return lines.join('\n');
    }
    case 'footnote-container':
      return node.children
        .map(fc => `[^${fc.number}]: ${inline(fc.children as SlateNode[])}`)
        .join('\n');
    case 'table-of-contents':
      return '';
    default:
      return inline(((node as { children?: SlateNode[] }).children ?? []) as SlateNode[]);
  }
};

export const generateMarkdownString = (nodes: SlateNode[]): string =>
  nodes
    .filter((n): n is CustomElement => !isText(n))
    .map(serializeBlock)
    .filter(block => block !== '')
    .join('\n\n') + '\n';

/** Plain-text export: document text with structure flattened to lines. */
export const generatePlainTextString = (nodes: SlateNode[]): string => {
  const lines: string[] = [];
  const walk = (node: SlateNode): string => {
    if (isText(node)) return node.text;
    return (node.children as SlateNode[]).map(walk).join('');
  };
  for (const node of nodes) {
    if (isText(node)) {
      lines.push(node.text);
      continue;
    }
    if (node.type === 'table') {
      for (const row of node.children) {
        lines.push(row.children.map(cell => walk(cell).trim()).join('\t'));
      }
      continue;
    }
    if (node.type === 'bulleted-list' || node.type === 'numbered-list') {
      node.children.forEach((item, i) => {
        const marker = node.type === 'numbered-list' ? `${i + 1}. ` : '- ';
        lines.push(marker + walk(item).trim());
      });
      continue;
    }
    if (node.type === 'horizontal-rule' || node.type === 'page-break') {
      lines.push('');
      continue;
    }
    lines.push(walk(node));
  }
  return lines.join('\n') + '\n';
};
