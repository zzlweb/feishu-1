import { useState, useRef, useEffect, useCallback } from 'react';
import './EmojiPicker.less';

/** 常用表情符号分类 */
const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    icon: '🕐',
    label: '最近使用',
    emojis: [] as string[],
  },
  {
    id: 'smileys',
    icon: '😀',
    label: '表情符号',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫',
      '🤔','🤐','🤨','😐','😑','😶','😏','😒','😮','😯',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳',
      '😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲',
      '😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢',
      '😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤',
      '😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹',
      '👺','👻','👽','👾','🤖',
    ],
  },
  {
    id: 'gestures',
    icon: '👋',
    label: '手势',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞',
      '🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍',
      '👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜',
      '👏','🙌','👐','🤲','🤝','🙏','💪','🦾',
    ],
  },
  {
    id: 'animals',
    icon: '🐶',
    label: '动物',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
      '🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒',
      '🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇',
      '🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞',
    ],
  },
  {
    id: 'food',
    icon: '🍔',
    label: '食物',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐',
      '🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
      '🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅',
      '🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳',
    ],
  },
  {
    id: 'objects',
    icon: '💡',
    label: '物品',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💾','💿',
      '📷','📹','🎥','📞','☎️','📺','📻','🎙️','⏰','⏳',
      '📡','🔋','🔌','💡','🔦','🕯️','🧯','💰','💳','💎',
      '⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','⚙️','🧲','🔫',
    ],
  },
  {
    id: 'symbols',
    icon: '❤️',
    label: '符号',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
      '⭐','🌟','💫','✨','⚡','🔥','💥','☀️','🌈','☁️',
      '✅','❌','❓','❗','⚠️','🔴','🟠','🟡','🟢','🔵',
    ],
  },
];

interface EmojiPickerProps {
  /** 当前已选中的 emoji（用于显示移除按钮） */
  currentEmoji?: string;
  onSelect: (emoji: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function EmojiPicker({ currentEmoji, onSelect, onRemove, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleEmojiClick = useCallback((emoji: string) => {
    onSelect(emoji);
  }, [onSelect]);

  const activeCategory = EMOJI_CATEGORIES.find(c => c.id === activeTab) || EMOJI_CATEGORIES[1];

  // Simple search - filter emojis (since we don't have emoji names, just show all on search)
  const displayEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis)
    : activeCategory.emojis;

  return (
    <div className="emoji-picker" ref={pickerRef}>
      {/* Tab bar */}
      <div className="emoji-picker-tabs">
        <button
          type="button"
          className={`emoji-tab ${activeTab === 'smileys' ? 'active' : ''}`}
          onClick={() => { setActiveTab('smileys'); setSearchQuery(''); }}
        >
          表情符号
        </button>
        <button
          type="button"
          className={`emoji-tab ${activeTab === 'symbols' ? 'active' : ''}`}
          onClick={() => { setActiveTab('symbols'); setSearchQuery(''); }}
        >
          图标
        </button>
        {currentEmoji && (
          <button
            type="button"
            className="emoji-remove-btn"
            onClick={onRemove}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.05 3.05a7 7 0 1 1 9.9 9.9 7 7 0 0 1-9.9-9.9Z" stroke="#646A73" strokeWidth="1.2"/>
              <path d="M5.5 8h5" stroke="#646A73" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>移除</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="emoji-search-wrapper">
        <div className="emoji-search-box">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-3-3" stroke="#8F959E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="emoji-search-input"
            placeholder="搜索"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="button" className="emoji-random-btn" title="随机">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 14l3-4 2.5 3L13 8l4 6H4Z" stroke="#8F959E" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>

      {/* Category label */}
      {!searchQuery && (
        <div className="emoji-category-label">{activeCategory.label}</div>
      )}

      {/* Emoji grid */}
      <div className="emoji-grid">
        {displayEmojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            className="emoji-cell"
            onClick={() => handleEmojiClick(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Bottom category tabs */}
      <div className="emoji-category-bar">
        {EMOJI_CATEGORIES.filter(c => c.id !== 'recent').map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`emoji-cat-btn ${activeTab === cat.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(cat.id); setSearchQuery(''); }}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
