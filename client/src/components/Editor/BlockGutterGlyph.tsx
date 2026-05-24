import { ContextGlyphText, FEISHU_TOOLBOX } from '../../icons/contextMenuGlyphs';
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
} from '../../icons/slashMenuGlyphs';

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
      return <SlashGlyphTable size={S} fill="#52c41a" />;
    case 'image':
      return <SlashGlyphImage size={S} fill={b500} />;
    case 'file':
      return <SlashGlyphSubDoc size={S} fill={g500} />;
    case 'embed':
    case 'subdoc':
      return <SlashGlyphSubDoc size={S} fill={b500} />;
    case 'paragraph':
      return <ContextGlyphText size={S} fill={b500} />;
    default:
      return null;
  }
}
