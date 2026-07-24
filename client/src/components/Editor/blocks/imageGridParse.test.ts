/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { LocalImageGridBlock } from './imageGridBlock';

function createEditor(content: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({ heading: false }),
      Image,
      LocalImageGridBlock,
    ],
    content,
  });
}

describe('image grid parse/save', () => {
  it('keeps data-images through TipTap getHTML roundtrip', () => {
    const html = [
      '<h4>1</h4>',
      '<div data-local-block="image-grid" data-cols="2" ',
      'data-images=\'[{"src":"/api/feishu-media/tok1"},{"src":"/api/feishu-media/tok2"}]\' ',
      'class="feishu-image-grid">',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/tok1"></figure>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/tok2"></figure>',
      '</div>',
    ].join('');

    const editor = createEditor(html);
    const grid = editor.state.doc.content.content.find(node => node.type.name === 'localImageGridBlock');
    expect(grid).toBeTruthy();
    expect(JSON.parse(String(grid?.attrs.images || '[]'))).toEqual([
      { src: '/api/feishu-media/tok1' },
      { src: '/api/feishu-media/tok2' },
    ]);

    const saved = editor.getHTML();
    expect(saved).toMatch(/data-images=/);
    expect(saved).toMatch(/\/api\/feishu-media\/tok1/);
    expect(saved).toMatch(/\/api\/feishu-media\/tok2/);
    editor.destroy();
  });

  it('keeps images after FeishuBlockId assigns blockId and getHTML', async () => {
    const { FeishuBlockId } = await import('./feishuBlockId');
    const html = [
      '<div data-local-block="image-grid" data-cols="2" ',
      'data-images=\'[{"src":"/api/feishu-media/tok1"},{"src":"/api/feishu-media/tok2"}]\' ',
      'class="feishu-image-grid">',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/tok1"></figure>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/tok2"></figure>',
      '</div>',
    ].join('');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({ heading: false }),
        FeishuBlockId,
        Image,
        LocalImageGridBlock,
      ],
      content: html,
    });
    // trigger appendTransaction
    editor.view.dispatch(editor.state.tr.setMeta('feishu-normalize-block-ids', true));
    const grid = editor.state.doc.firstChild;
    expect(grid?.type.name).toBe('localImageGridBlock');
    expect(JSON.parse(String(grid?.attrs.images || '[]')).length).toBe(2);
    expect(grid?.attrs.blockId).toBeTruthy();
    const saved = editor.getHTML();
    expect(saved).toMatch(/data-images=/);
    expect(saved).toMatch(/feishu-media\/tok1/);
    editor.destroy();
  });

  it('parses HTML-entity encoded data-images from emitter', () => {
    const html = [
      '<div data-local-block="image-grid" data-cols="2" class="feishu-image-grid" ',
      'data-images="[{&quot;src&quot;:&quot;/api/feishu-media/tok1&quot;},{&quot;src&quot;:&quot;/api/feishu-media/tok2&quot;}]">',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/tok1"></figure>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/tok2"></figure>',
      '</div>',
    ].join('');
    const editor = createEditor(html);
    expect(JSON.parse(String(editor.state.doc.firstChild?.attrs.images || '[]')).length).toBe(2);
    editor.destroy();
  });

  it('parses image-grid when only child imgs exist (no data-images)', () => {
    const html = [
      '<div data-local-block="image-grid" data-cols="2" class="feishu-image-grid">',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/a"></figure>',
      '<figure class="feishu-image-grid__cell"><img class="feishu-image" src="/api/feishu-media/b"></figure>',
      '</div>',
    ].join('');
    const editor = createEditor(html);
    const grid = editor.state.doc.firstChild;
    expect(grid?.type.name).toBe('localImageGridBlock');
    expect(JSON.parse(String(grid?.attrs.images || '[]')).length).toBe(2);
    editor.destroy();
  });
});
