import { ContextGlyphText, FEISHU_TOOLBOX } from '../../../icons/contextMenuGlyphs';
import {
  SlashGlyphOrderedList,
  SlashGlyphBulletList,
  SlashGlyphTaskList,
  SlashGlyphCode,
  SlashGlyphQuote,
  SlashGlyphDivider,
  SlashGlyphHighlight,
  SlashGlyphTable,
  SlashGlyphImage,
  SlashGlyphSubDoc,
  SlashGlyphButton,
  SlashGlyphLink,
  SlashGlyphFormula,
} from '../../../icons/slashMenuGlyphs';

function GlyphFileBitableColorful({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 2.5a1 1 0 0 1 1-1h12.865a5.24 5.24 0 0 1 3.631 1.447A4.848 4.848 0 0 1 21.5 6.441V21.5a1 1 0 0 1-1 1H7.635a5.24 5.24 0 0 1-3.63-1.447A4.849 4.849 0 0 1 2.5 17.559V2.5Z" fill="#8046F3" />
      <path d="M12 8.26 15.74 12 12 15.735 8.26 12 12 8.26ZM8.26 12 6.5 14.275 9.725 17.5 12 15.735l2.275 1.765 3.225-3.225L15.74 12l1.76-2.275L14.275 6.5 12 8.26 9.725 6.5 6.5 9.725 8.26 12Z" fill="#fff" />
    </svg>
  );
}

const S = 16;
const { b500, i500, g500, n1 } = FEISHU_TOOLBOX;

function HeadingGutterLabel({ level }: { level: number }) {
  return (
    <span className="block-gutter-heading-label" aria-hidden>
      H
      <sub className="block-gutter-heading-sub">{level}</sub>
    </span>
  );
}

/** 行侧块柄：标题为飞书式 Hn 文案；其余与 ContextMenu 同一套图标 + 语义色 */
export default function BlockGutterGlyph({ type }: { type: string }) {
  switch (type) {
    case 'h1':
      return <HeadingGutterLabel level={1} />;
    case 'h2':
      return <HeadingGutterLabel level={2} />;
    case 'h3':
      return <HeadingGutterLabel level={3} />;
    case 'h4':
      return <HeadingGutterLabel level={4} />;
    case 'h5':
      return <HeadingGutterLabel level={5} />;
    case 'h6':
      return <HeadingGutterLabel level={6} />;
    case 'bulletList':
      return <SlashGlyphBulletList size={S} fill={i500} />;
    case 'orderedList':
      return <SlashGlyphOrderedList size={S} fill={i500} />;
    case 'task':
      return <SlashGlyphTaskList size={S} fill={i500} />;
    case 'blockquote':
      return <SlashGlyphQuote size={S} fill={b500} />;
    case 'codeBlock':
      return <SlashGlyphCode size={S} fill={g500} />;
    case 'highlightBlock':
      return <SlashGlyphHighlight size={S} fill="#fa8c16" />;
    case 'hr':
      return <SlashGlyphDivider size={S} fill={n1} />;
    case 'table':
    case 'bitable':
    case 'bitable-gallery':
    case 'bitable-gantt':
    case 'bitable-kanban':
      return <GlyphFileBitableColorful size={S} />;
    case 'div-table':
      return <SlashGlyphTable size={S} fill="#52c41a" />;
    case 'image':
      return <SlashGlyphImage size={S} fill={b500} />;
    case 'file':
      return <SlashGlyphSubDoc size={S} fill={g500} />;
    case 'embed':
    case 'subdoc':
    case 'sync':
      return <SlashGlyphSubDoc size={S} fill={b500} />;
    case 'paragraph':
      return <ContextGlyphText size={S} fill={b500} />;
    case 'button':
    case 'button-duplicate':
    case 'button-follow':
      return <SlashGlyphButton size={S} fill="#597ef7" />;
    case 'button-link':
      return <SlashGlyphLink size={S} fill={b500} />;
    case 'formula':
      return <SlashGlyphFormula size={S} fill="#8f959e" />;
    default:
      return null;
  }
}
