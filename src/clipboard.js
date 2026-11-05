// Keep source typography and explicitly reset Word paragraph alignment and gaps.
export function compactClipboardHtml(html, text) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content.firstElementChild;
  if (!root) return undefined;
  const color = value => {
    const probe = document.createElement('span');
    probe.style.color = value;
    return probe.style.color;
  };
  const foreground = color(root.style.color);
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const printable = value => {
    const normalized = color(value);
    if (!normalized || normalized === foreground) return '#000000';
    // Light text from the dark theme needs sufficient contrast on white paper.
    const match = normalized.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return normalized;
    const rgb = match.slice(1).map(Number);
    const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    if (luminance <= 150) return normalized;
    return `rgb(${rgb.map(n => Math.round(n * 150 / luminance)).join(', ')})`;
  };
  // Monaco inserts nonbreaking spaces and expands tabs for browsers. Office
  // treats these as real document characters, changing wrapping and alignment.
  // Recover characters from text/plain; use the HTML only for token colors.
  const htmlLines = Array.from(root.childNodes);
  const rawLines = typeof text === 'string' ? text.split(/\r\n|\r|\n/) : htmlLines.map(node => node.nodeName === 'BR' ? '' : node.textContent.replace(/\u00a0/g, ' '));
  const font = root.style.fontFamily || 'Consolas, Microsoft YaHei UI, monospace';
  const pixels = parseFloat(root.style.fontSize) || 14;
  const weight = root.style.fontWeight || '400';
  const context = document.createElement('canvas').getContext('2d');
  context.font = `${weight} ${pixels}px ${font}`;
  const spaceWidth = context.measureText(' ').width;
  const widths = rawLines.map(line => context.measureText(line.replace(/\t/g, '    ')).width);
  // WPS treats preformatted CJK spaces as half-em. Explicit character spacing
  // restores the editor's measured advance without substituting NBSP characters.
  const spaceSpacing = spaceWidth - pixels / 2;
  // A4 with the common 90pt document margins leaves 415pt. Reserve a little
  // room for Office font rounding. Only structured command/table blocks are
  // reduced; ordinary prose keeps its chosen size. A floor keeps unusually
  // long rows readable and lets the destination document wrap them instead.
  const maxWidth = 400 * 4 / 3;
  const minimumScale = .8;
  const scales = rawLines.map(() => 1);
  const structured = line => /^\S.*\S[ \t]{2,}\S/.test(line);
  for (let i = 0; i < rawLines.length;) {
    if (!structured(rawLines[i])) { i++; continue; }
    let end = i + 1;
    while (end < rawLines.length && structured(rawLines[end])) end++;
    const scale = Math.max(minimumScale, Math.min(...widths.slice(i, end).map(width => maxWidth / Math.max(1, width))));
    scales.fill(scale, i, end);
    i = end;
  }
  const lines = rawLines.map((raw, index) => {
    const cells = [];
    const visit = (node, inherited = '#000000') => {
      if (node.nodeType === Node.TEXT_NODE) {
        for (const character of node.textContent.split('')) cells.push({character, color: inherited});
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const ownColor = node.style.color ? printable(node.style.color) : inherited;
        for (const child of node.childNodes) visit(child, ownColor);
      }
    };
    if (htmlLines[index]?.nodeName !== 'BR' && htmlLines[index]) visit(htmlLines[index]);
    let at = 0, result = '';
    const whitespace = character => character === ' ' || character === '\t' || character === '\u00a0';
    for (let i = 0; i < raw.length;) {
      if (whitespace(raw[i])) {
        let spaces = '';
        while (i < raw.length && whitespace(raw[i])) spaces += raw[i++];
        while (at < cells.length && whitespace(cells[at].character)) at++;
        result += spaces.split(/(\t)/).map(part => part === '\t'
          ? `<span style="mso-tab-count:1"></span>`
          : part ? `<span style="mso-spacerun:yes;letter-spacing:${(spaceSpacing * scales[index]).toFixed(3)}px">${escape(part)}</span>` : '').join('');
      } else {
        const tokenColor = cells[at]?.color || '#000000';
        let content = '';
        do { content += raw[i++]; at++; }
        while (i < raw.length && !whitespace(raw[i]) && (cells[at]?.color || '#000000') === tokenColor);
        result += `<span style="color:${tokenColor}">${escape(content)}</span>`;
      }
    }
    // WPS turns an empty Word tab marker into exactly one tab character. Put
    // no tab or nonbreaking space inside the marker; either would be counted.
    return result;
  });
  return lines.map((line, index) => {
    const size = (pixels * scales[index]).toFixed(3) + 'px';
    const style = `margin:0;padding:0;text-align:left;text-indent:0;white-space:pre-wrap;color:#000000;font-family:${font};font-size:${size};font-weight:${weight};line-height:normal;layout-grid-mode:none;mso-para-margin:0;mso-pagination:none`;
    return `<pre align="left" style="${escape(style)}">${line || '<br>'}</pre>`;
  }).join('');
}

export function installClipboard(editor, monaco, toast) {
  const prepare = event => {
    // Mutating the payload leaves Monaco's cut/undo and multicursor metadata
    // intact. This event contract is covered against the pinned Monaco build.
    if (event.dataToCopy.html) event.dataToCopy.html = compactClipboardHtml(event.dataToCopy.html, event.dataToCopy.text);
  };
  editor.onWillCopy(prepare);
  editor.onWillCut(prepare);
  const copyPlain = async () => {
    const rtl = document.getElementById('rtl-editor');
    if (rtl && !rtl.hidden) {
      await navigator.clipboard.writeText(rtl.value.slice(rtl.selectionStart, rtl.selectionEnd));
      return;
    }
    editor.focus();
    const model = editor.getModel();
    if (!model) return;
    const selections = editor.getSelections().slice().sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);
    const allEmpty = selections.every(selection => selection.isEmpty());
    const text = allEmpty
      ? [...new Set(selections.map(selection => selection.startLineNumber))].map(line => model.getLineContent(line) + model.getEOL()).join('')
      : selections.filter(selection => !selection.isEmpty()).map(selection => model.getValueInRange(selection)).join(model.getEOL());
    await navigator.clipboard.writeText(text);
  };
  editor.addAction({
    id: 'jianwen.copyPlainText', label: '复制为纯文本',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC],
    run: () => copyPlain().catch(error => toast(error.message))
  });
  document.getElementById('copy-plain').onclick = () => copyPlain().catch(error => toast(error.message));
  document.getElementById('rtl-editor')?.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copyPlain().catch(error => toast(error.message));
    }
  });
}
