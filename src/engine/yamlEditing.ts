export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function getSelectedLineRange(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextNewline = value.indexOf('\n', effectiveEnd);
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  return { lineStart, lineEnd };
}

export function unindentYamlSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number
): EditResult {
  const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  let removedFirstLine = 0;
  let totalRemoved = 0;

  const updatedLines = lines.map((line, idx) => {
    let removed = 0;
    let nextLine = line;
    if (line.startsWith('  ')) {
      nextLine = line.slice(2);
      removed = 2;
    } else if (line.startsWith(' ') || line.startsWith('\t')) {
      nextLine = line.slice(1);
      removed = 1;
    }
    if (idx === 0) removedFirstLine = removed;
    totalRemoved += removed;
    return nextLine;
  });

  if (totalRemoved === 0) {
    return { value, selectionStart, selectionEnd };
  }

  const nextValue = value.slice(0, lineStart) + updatedLines.join('\n') + value.slice(lineEnd);
  const nextStart = Math.max(lineStart, selectionStart - removedFirstLine);
  const nextEnd = Math.max(nextStart, selectionEnd - totalRemoved);

  return {
    value: nextValue,
    selectionStart: nextStart,
    selectionEnd: nextEnd,
  };
}

export function toggleYamlComments(
  value: string,
  selectionStart: number,
  selectionEnd: number
): EditResult {
  const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return { value, selectionStart, selectionEnd };
  }

  const allCommented = nonEmptyLines.every((l) => /^\s*#/.test(l));
  let firstLineDelta = 0;
  let totalDelta = 0;

  const updatedLines = lines.map((line, idx) => {
    if (line.trim().length === 0) return line;
    let nextLine = line;
    if (allCommented) {
      const m = line.match(/^(\s*)# ?(.*)$/);
      if (m) {
        nextLine = `${m[1]}${m[2]}`;
      }
    } else {
      const m = line.match(/^(\s*)(.*)$/);
      if (m) {
        nextLine = `${m[1]}# ${m[2]}`;
      }
    }
    const delta = nextLine.length - line.length;
    if (idx === 0) firstLineDelta = delta;
    totalDelta += delta;
    return nextLine;
  });

  const nextValue = value.slice(0, lineStart) + updatedLines.join('\n') + value.slice(lineEnd);
  const nextStart = Math.max(lineStart, selectionStart + firstLineDelta);
  const nextEnd = Math.max(nextStart, selectionEnd + totalDelta);

  return {
    value: nextValue,
    selectionStart: nextStart,
    selectionEnd: nextEnd,
  };
}
