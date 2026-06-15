import { Editor, Element as SlateElement, Node, NodeEntry, Path, Transforms } from 'slate';
import { TableCellElement, TableElement, TableRowElement } from '../CustomTypes';

/** Table editing commands used by the floating table toolbar. */

export const getActiveTable = (editor: Editor): NodeEntry<TableElement> | null => {
  if (!editor.selection) return null;
  const [match] = Editor.nodes<TableElement>(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'table',
  });
  return match ?? null;
};

const getActiveCell = (editor: Editor): NodeEntry<TableCellElement> | null => {
  if (!editor.selection) return null;
  const [match] = Editor.nodes<TableCellElement>(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'table-cell',
  });
  return match ?? null;
};

const getActiveRow = (editor: Editor): NodeEntry<TableRowElement> | null => {
  if (!editor.selection) return null;
  const [match] = Editor.nodes<TableRowElement>(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'table-row',
  });
  return match ?? null;
};

const makeCell = (): TableCellElement => ({ type: 'table-cell', children: [{ text: '' }] });

export const insertRow = (editor: Editor, position: 'above' | 'below'): void => {
  const row = getActiveRow(editor);
  if (!row) return;
  const [rowNode, rowPath] = row;
  const newRow: TableRowElement = {
    type: 'table-row',
    children: rowNode.children.map(() => makeCell()),
  };
  const at = position === 'above' ? rowPath : Path.next(rowPath);
  Transforms.insertNodes(editor, newRow, { at });
};

export const deleteRow = (editor: Editor): void => {
  const table = getActiveTable(editor);
  const row = getActiveRow(editor);
  if (!table || !row) return;
  if (table[0].children.length <= 1) {
    Transforms.removeNodes(editor, { at: table[1] });
  } else {
    Transforms.removeNodes(editor, { at: row[1] });
  }
};

export const insertColumn = (editor: Editor, position: 'left' | 'right'): void => {
  const table = getActiveTable(editor);
  const cell = getActiveCell(editor);
  if (!table || !cell) return;
  const [tableNode, tablePath] = table;
  const cellIndex = cell[1][cell[1].length - 1];
  const insertIndex = position === 'left' ? cellIndex : cellIndex + 1;
  Editor.withoutNormalizing(editor, () => {
    tableNode.children.forEach((rowNode, rowIndex) => {
      const at = [...tablePath, rowIndex, Math.min(insertIndex, rowNode.children.length)];
      Transforms.insertNodes(editor, makeCell(), { at });
    });
  });
};

export const deleteColumn = (editor: Editor): void => {
  const table = getActiveTable(editor);
  const row = getActiveRow(editor);
  const cell = getActiveCell(editor);
  if (!table || !row || !cell) return;
  if (row[0].children.length <= 1) {
    Transforms.removeNodes(editor, { at: table[1] });
    return;
  }
  const [tableNode, tablePath] = table;
  const cellIndex = cell[1][cell[1].length - 1];
  Editor.withoutNormalizing(editor, () => {
    for (let rowIndex = tableNode.children.length - 1; rowIndex >= 0; rowIndex--) {
      if (cellIndex < tableNode.children[rowIndex].children.length) {
        Transforms.removeNodes(editor, { at: [...tablePath, rowIndex, cellIndex] });
      }
    }
  });
};

/** Merge the active cell with its right neighbor (content + colSpan). */
export const mergeCellRight = (editor: Editor): void => {
  const cell = getActiveCell(editor);
  const row = getActiveRow(editor);
  if (!cell || !row) return;
  const [cellNode, cellPath] = cell;
  const cellIndex = cellPath[cellPath.length - 1];
  if (cellIndex >= row[0].children.length - 1) return;

  const nextPath = Path.next(cellPath);
  const nextCell = Node.get(editor, nextPath) as TableCellElement;

  Editor.withoutNormalizing(editor, () => {
    const insertAt = [...cellPath, cellNode.children.length];
    Transforms.removeNodes(editor, { at: nextPath });
    const moved = nextCell.children.filter(
      child => Node.string({ type: 'table-cell', children: [child] } as TableCellElement).trim() !== ''
    );
    if (moved.length > 0) {
      Transforms.insertNodes(editor, moved, { at: insertAt });
    }
    Transforms.setNodes(
      editor,
      { colSpan: (cellNode.colSpan ?? 1) + (nextCell.colSpan ?? 1) },
      { at: cellPath }
    );
  });
};

/** Undo a horizontal merge: restore the spanned columns as empty cells. */
export const splitCell = (editor: Editor): void => {
  const cell = getActiveCell(editor);
  if (!cell) return;
  const [cellNode, cellPath] = cell;
  const span = cellNode.colSpan ?? 1;
  if (span <= 1) return;
  Editor.withoutNormalizing(editor, () => {
    Transforms.unsetNodes(editor, 'colSpan', { at: cellPath });
    for (let i = 1; i < span; i++) {
      Transforms.insertNodes(editor, makeCell(), { at: Path.next(cellPath) });
    }
  });
};

export const setCellBackground = (editor: Editor, color: string | null): void => {
  if (!editor.selection) return;
  const cells = Array.from(
    Editor.nodes<TableCellElement>(editor, {
      match: n => SlateElement.isElement(n) && n.type === 'table-cell',
    })
  );
  for (const [, path] of cells) {
    if (color) Transforms.setNodes(editor, { backgroundColor: color }, { at: path });
    else Transforms.unsetNodes(editor, 'backgroundColor', { at: path });
  }
};

export const canMergeRight = (editor: Editor): boolean => {
  const cell = getActiveCell(editor);
  const row = getActiveRow(editor);
  if (!cell || !row) return false;
  return cell[1][cell[1].length - 1] < row[0].children.length - 1;
};

export const canSplit = (editor: Editor): boolean => {
  const cell = getActiveCell(editor);
  return !!cell && (cell[0].colSpan ?? 1) > 1;
};
