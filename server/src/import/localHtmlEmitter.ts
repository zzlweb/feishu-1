import type { EmittedImportPayload, ImportedBlock, ImportedDocument, ImportedInline, ImportedTableCell } from './types';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function renderInline(inline: ImportedInline) {
  let text = escapeHtml(inline.text);
  if (!text) return '';
  if (inline.link) text = `<a href="${escapeAttr(inline.link)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  if (inline.bold) text = `<strong>${text}</strong>`;
  if (inline.italic) text = `<em>${text}</em>`;
  if (inline.underline) text = `<u>${text}</u>`;
  if (inline.strike) text = `<s>${text}</s>`;
  return text;
}

function renderInlines(inlines: ImportedInline[]) {
  const html = inlines.map(renderInline).join('');
  return html || '<br>';
}

function renderBlockChildren(blocks: ImportedBlock[]) {
  return blocks.map(renderImportedBlock).join('');
}

function renderTableCell(cell: ImportedTableCell) {
  const tag = cell.header ? 'th' : 'td';
  const className = cell.header ? 'feishu-table__header-cell' : 'feishu-table__cell';
  const attrs = [
    `class="${className}"`,
    'data-table-cell="true"',
    cell.rowSpan && cell.rowSpan > 1 ? `rowspan="${cell.rowSpan}"` : '',
    cell.colSpan && cell.colSpan > 1 ? `colspan="${cell.colSpan}"` : '',
    cell.bgColor ? `style="background-color:${escapeAttr(cell.bgColor)}"` : '',
  ].filter(Boolean).join(' ');
  const blockInner = cell.blocks?.length ? renderBlockChildren(cell.blocks) : '';
  const inner = blockInner || (cell.content
    ? `<p>${escapeHtml(cell.content)}</p>`
    : '<p><br></p>');
  return `<${tag} ${attrs}>${inner}</${tag}>`;
}

function stringifyJsonAttr(value: unknown) {
  return escapeAttr(JSON.stringify(value));
}

function compactMessages(messages: string[]) {
  const counts = new Map<string, number>();
  messages.forEach(message => {
    counts.set(message, (counts.get(message) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([message, count]) =>
    count > 1 ? `${message}（共 ${count} 处）` : message,
  );
}

export function renderImportedBlock(block: ImportedBlock): string {
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(1, block.level || 1));
    return `<h${level}>${renderInlines(block.inlines)}</h${level}>`;
  }

  if (block.type === 'paragraph') return `<p>${renderInlines(block.inlines)}</p>`;
  if (block.type === 'quote') return `<blockquote>${renderBlockChildren(block.blocks)}</blockquote>`;
  if (block.type === 'code') {
    const language = escapeAttr(block.language || 'plaintext');
    return `<pre><code class="language-${language}">${escapeHtml(block.code) || '\n'}</code></pre>`;
  }
  if (block.type === 'divider') return '<hr>';
  if (block.type === 'image') {
    return `<img class="feishu-image" data-align="center" src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt || '')}">`;
  }
  if (block.type === 'table') {
    const rows = block.rows.map(row => `<tr>${row.map(renderTableCell).join('')}</tr>`).join('');
    return `<table class="feishu-table"><tbody>${rows}</tbody></table>`;
  }
  if (block.type === 'taskList') {
    const items = block.items.map(item => [
      `<li data-block-id="${escapeAttr(item.id)}" id="${escapeAttr(item.id)}" data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}">`,
      `<label><input type="checkbox"${item.checked ? ' checked="checked"' : ''}><span></span></label>`,
      `<div><p>${escapeHtml(item.text)}</p></div></li>`,
    ].join('')).join('');
    return `<ul data-type="taskList">${items}</ul>`;
  }
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = block.items.map(item => `<li>${renderBlockChildren(item.blocks)}</li>`).join('');
    return `<${tag}>${items}</${tag}>`;
  }
  if (block.type === 'docNav') {
    const links = stringifyJsonAttr(block.links);
    const items = block.links.map(link => {
      const label = escapeHtml(link.label);
      return link.href
        ? `<a class="feishu-doc-nav__link" href="${escapeAttr(link.href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `<span class="feishu-doc-nav__link">${label}</span>`;
    }).join('<span class="feishu-doc-nav__separator">|</span>');
    return `<div data-local-block="doc-nav" data-links="${links}" class="feishu-doc-nav">${items}</div>`;
  }
  if (block.type === 'columns') {
    const fallbackWidth = Math.floor(100 / Math.max(block.columns.length, 1));
    const columns = block.columns.map((column, index) => [
      `<div class="feishu-columns-block__col-wrap" data-width-ratio="${block.ratios?.[index] ?? fallbackWidth}" data-local-column="true">`,
      `<div class="feishu-columns-block__col">${renderBlockChildren(column)}</div></div>`,
    ].join('')).join('');
    return `<div class="feishu-columns-node" data-local-block="columns">${columns}</div>`;
  }
  if (block.type === 'highlight') {
    const bg = escapeAttr(block.bgColor || '#e1eaff');
    const border = escapeAttr(block.borderColor || '#82a7fc');
    const text = escapeAttr(block.textColor || '#1f2329');
    const icon = escapeAttr(block.icon || '📍');
    return [
      `<div data-type="highlight-block" data-icon="${icon}" data-bg-color="${bg}" data-border-color="${border}"`,
      ` data-text-color="${text}" class="feishu-highlight-block">${renderBlockChildren(block.content)}</div>`,
    ].join('');
  }
  if (block.type === 'bitable') {
    const model = block.payload.table;
    const view = escapeAttr(block.payload.defaultView || 'grid');
    return `<div data-local-block="bitable" data-view="${view}" data-model="${stringifyJsonAttr(model)}"></div>`;
  }
  if (block.type === 'dashboard') {
    const config: Record<string, unknown> = {
      ...(block.payload.config || {}),
      slices: block.payload.fallbackSlices || (block.payload.config || {}).slices,
    };
    const fallbackSlices = block.payload.fallbackSlices || [];
    const sourceTableId = typeof config.link === 'object' && config.link && 'sourceTableId' in config.link
      ? String((config.link as { sourceTableId?: unknown }).sourceTableId || '')
      : '';
    return [
      `<div data-local-block="dashboard" data-chart-type="donut" data-title="${escapeAttr(block.payload.title)}"`,
      sourceTableId ? ` data-source-table-id="${escapeAttr(sourceTableId)}"` : '',
      ` data-config="${stringifyJsonAttr(config)}" data-fallback-slices="${stringifyJsonAttr(fallbackSlices)}"></div>`,
    ].join('');
  }
  if (block.type === 'embed') {
    const href = block.url ? ` data-href="${escapeAttr(block.url)}"` : '';
    const kind = block.kind ? ` data-kind="${escapeAttr(block.kind)}"` : '';
    const desc = block.desc ? ` data-desc="${escapeAttr(block.desc)}"` : '';
    return `<div data-local-block="embed"${kind}${href}${desc} data-title="${escapeAttr(block.title)}">${escapeHtml(block.title)}</div>`;
  }
  return block.html;
}

export function emitLocalHtml(document: ImportedDocument): EmittedImportPayload {
  const sourceBlock = document.showSourceAttribution === true && document.sourceUrl
    ? `<blockquote><p>来源：<a href="${escapeAttr(document.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(document.sourceUrl)}</a></p></blockquote>`
    : '';
  const content = `${sourceBlock}${renderBlockChildren(document.blocks)}` || '<p></p>';
  const unsupportedBlocks = Array.from(document.warnings
    .filter(warning => warning.type === 'unsupported-block')
    .reduce((grouped, warning) => {
      const type = warning.blockType || 'unknown';
      const current = grouped.get(type);
      if (current) current.count += 1;
      else grouped.set(type, { reason: warning.message, count: 1 });
      return grouped;
    }, new Map<string, { reason: string; count: number }>()))
    .map(([type, value]) => ({
      type,
      reason: value.count > 1 ? `${value.reason}（共 ${value.count} 处）` : value.reason,
    }));

  return {
    title: document.title || '飞书文档',
    content,
    sourceName: document.sourceName,
    sourceUrl: document.sourceUrl,
    assetCount: document.assets.filter(asset => asset.status === 'downloaded').length,
    warnings: compactMessages(document.warnings.map(warning => warning.message)),
    importQuality: document.importQuality,
    unsupportedBlocks: unsupportedBlocks.length ? unsupportedBlocks : undefined,
    coverUrl: document.coverUrl,
    importMetadata: document.importMetadata,
  };
}
