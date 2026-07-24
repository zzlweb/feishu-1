/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  canSideLayoutDrop,
  moveBlocksIntoColumnsLayout,
  moveDraggableBlock,
  resolveDraggableBlockPos,
} from './feishuBlockDrag';
import { localColumnsExtensions } from './columnsExtensions';
import { LocalImageGridBlock } from './imageGridBlock';
import Image from '@tiptap/extension-image';

function createEditor(content: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ heading: false }),
      Image,
      ...localColumnsExtensions,
      LocalImageGridBlock,
    ],
    content,
  });
  return editor;
}

describe('feishu side drag layout', () => {
  it('allows sibling paragraphs to form columns', () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    const first = editor.view.dom.querySelector('p');
    const second = editor.view.dom.querySelectorAll('p')[1];
    expect(first && second).toBeTruthy();
    const source = resolveDraggableBlockPos(editor as any, first as HTMLElement);
    const target = resolveDraggableBlockPos(editor as any, second as HTMLElement);
    expect(canSideLayoutDrop(editor as any, source, target)).toBe(true);
    editor.destroy();
  });

  it('wraps sibling paragraphs into two columns on side drop', () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    const first = editor.view.dom.querySelector('p') as HTMLElement;
    const second = editor.view.dom.querySelectorAll('p')[1] as HTMLElement;
    expect(moveBlocksIntoColumnsLayout(editor as any, first, second, 'right')).toBe(true);
    expect(editor.getHTML()).toMatch(/data-local-block="columns"/);
    expect(editor.getHTML()).toMatch(/Alpha/);
    expect(editor.getHTML()).toMatch(/Beta/);
    editor.destroy();
  });

  it('moves a block into an existing column with before/after drop', () => {
    const editor = createEditor([
      '<p>Drag me</p>',
      '<div data-local-block="columns" class="feishu-columns-node">',
      '<div data-local-column="true" data-width-ratio="50" class="feishu-columns-block__col-wrap">',
      '<div class="feishu-columns-block__col"><p>Left column</p></div></div>',
      '<div data-local-column="true" data-width-ratio="50" class="feishu-columns-block__col-wrap">',
      '<div class="feishu-columns-block__col"><p>Right column</p></div></div>',
      '</div>',
    ].join(''));

    const source = editor.view.dom.querySelector('p') as HTMLElement;
    const target = Array.from(editor.view.dom.querySelectorAll('p'))
      .find(p => p.textContent === 'Right column') as HTMLElement;
    expect(source && target).toBeTruthy();
    expect(moveDraggableBlock(editor as any, source, target, 'after')).toBe(true);
    const rightCol = Array.from(editor.view.dom.querySelectorAll('.feishu-columns-block__col'))
      .find(col => /Right column/.test(col.textContent || ''));
    expect(rightCol?.textContent || '').toMatch(/Drag me/);
    editor.destroy();
  });

  it('adds a third column when dragging onto the side of a column block', () => {
    const editor = createEditor([
      '<p>Third</p>',
      '<div data-local-block="columns" class="feishu-columns-node">',
      '<div data-local-column="true" data-width-ratio="50" class="feishu-columns-block__col-wrap">',
      '<div class="feishu-columns-block__col"><p>Left column</p></div></div>',
      '<div data-local-column="true" data-width-ratio="50" class="feishu-columns-block__col-wrap">',
      '<div class="feishu-columns-block__col"><p>Right column</p></div></div>',
      '</div>',
    ].join(''));

    const source = editor.view.dom.querySelector('p') as HTMLElement;
    const target = Array.from(editor.view.dom.querySelectorAll('p'))
      .find(p => p.textContent === 'Right column') as HTMLElement;
    expect(source && target).toBeTruthy();
    const sourcePos = resolveDraggableBlockPos(editor as any, source);
    const targetPos = resolveDraggableBlockPos(editor as any, target);
    expect(canSideLayoutDrop(editor as any, sourcePos, targetPos)).toBe(true);
    expect(moveBlocksIntoColumnsLayout(editor as any, source, target, 'right')).toBe(true);
    expect(editor.view.dom.querySelectorAll('[data-local-column], .feishu-columns-block__col-wrap').length)
      .toBeGreaterThanOrEqual(3);
    expect(editor.getHTML()).toMatch(/Third/);
    editor.destroy();
  });

  it('reorders cells within a two-column image grid', () => {
    const editor = createEditor([
      '<div data-local-block="image-grid" data-cols="2" class="feishu-image-grid" ',
      'data-images=\'[{"src":"https://example.com/a.png"},{"src":"https://example.com/b.png"}]\'>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="https://example.com/a.png" /></figure>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="https://example.com/b.png" /></figure>',
      '</div>',
    ].join(''));

    const grid = editor.view.dom.querySelector('.feishu-image-grid') as HTMLElement;
    expect(grid).toBeTruthy();
    const moved = moveDraggableBlock(editor as any, grid, grid, 'before', {
      sourceCellIndex: 1,
      targetInsertIndex: 0,
    });
    expect(moved).toBe(true);
    const gridNode = editor.state.doc.firstChild;
    expect(gridNode?.type.name).toBe('localImageGridBlock');
    const images = parseImagesFromGridNode(gridNode?.attrs.images).map(item => item.src);
    expect(images).toEqual(['https://example.com/b.png', 'https://example.com/a.png']);
    editor.destroy();
  });

  it('allows side drop hints inside image grid', () => {
    const editor = createEditor([
      '<div data-local-block="image-grid" data-cols="2" class="feishu-image-grid" ',
      'data-images=\'[{"src":"https://example.com/a.png"},{"src":"https://example.com/b.png"}]\'>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="https://example.com/a.png" /></figure>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="https://example.com/b.png" /></figure>',
      '</div>',
    ].join(''));

    const grid = editor.view.dom.querySelector('.feishu-image-grid') as HTMLElement;
    const pos = resolveDraggableBlockPos(editor as any, grid);
    expect(canSideLayoutDrop(editor as any, pos, pos)).toBe(true);
    editor.destroy();
  });

  it('round-trips image grid html with nested nodeview dom shape', () => {
    const html = [
      '<div data-local-block="image-grid" data-cols="2" data-images=\'[{"src":"https://example.com/a.png"}]\' class="feishu-image-grid">',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="https://example.com/a.png" /></figure>',
      '</div>',
    ].join('');
    const editor = createEditor(html);
    const saved = editor.getHTML();
    expect(saved).toMatch(/data-images=/);
    editor.destroy();

    const reloaded = createEditor(
      '<div data-local-block="image-grid" data-cols="2" class="feishu-image-grid">'
      + '<div class="feishu-image-grid__surface">'
      + '<figure class="feishu-image-grid__cell"><img class="feishu-image-grid__img" src="https://example.com/a.png" /></figure>'
      + '</div></div>',
    );
    const node = reloaded.state.doc.firstChild;
    expect(parseImagesFromGridNode(node?.attrs.images)).toEqual([{ src: 'https://example.com/a.png' }]);
    reloaded.destroy();
  });
});

function parseImagesFromGridNode(raw: unknown): Array<{ src: string }> {
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseImagesFromGridNode(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => ({ src: String((item as { src?: string }).src || '') }))
    .filter(item => item.src);
}
