import { useId, type ComponentType, type ReactNode } from 'react';
export type SlashIconProps = {
  theme?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
};

export type SlashIcon = ComponentType<SlashIconProps>;

function FsFill({
  size = 18,
  fill = 'currentColor',
  className,
  children,
}: SlashIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** 基础：标题与列表（飞书 H1/H2/H3、有序/无序/待办） */
export const SlashGlyphHeading1: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M2 3a1 1 0 0 0-1 1v16a1 1 0 1 0 2 0v-7h9v7a1 1 0 1 0 2 0V4a1 1 0 1 0-2 0v7H3V4a1 1 0 0 0-1-1Zm15.604 9.91a.4.4 0 0 1-.585-.355c0-.533 0-.774.004-1.582a.4.4 0 0 1 .203-.347l2.769-1.568A.39.39 0 0 1 20.197 9h1.404c.234 0 .423.21.423.468V19.95c0 .593-.483 1.073-1.075 1.073a1.07 1.07 0 0 1-1.07-1.073v-8.228l-2.275 1.19Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphHeading2: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M2 3a1 1 0 0 0-1 1v16a1 1 0 1 0 2 0v-7h9v7a1 1 0 1 0 2 0V4a1 1 0 1 0-2 0v7H3V4a1 1 0 0 0-1-1Zm20.993 16.872c0-.561-.455-1.015-1.017-1.015h-3.121l3.407-4.272a3.35 3.35 0 0 0 .731-2.126c-.01-.992-.347-1.816-1.005-2.464-.647-.651-1.492-.984-2.523-.995-.931.011-1.72.34-2.356.982-.37.386-.941 1.044-.941 1.602 0 .591.48 1.07 1.07 1.07.563 0 .769-.347.993-.726.06-.101.12-.204.19-.304a1.36 1.36 0 0 1 .186-.214c.262-.252.584-.376.982-.376.447.01.784.15 1.02.423.234.28.35.606.35.987 0 .146-.019.303-.057.471-.05.152-.156.341-.315.548l-4.402 5.506a.4.4 0 0 0-.087.25v1.022c0 .221.267.65.606.65h5.272c.562 0 1.017-.457 1.017-1.019Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphHeading3: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M2 3a1 1 0 0 0-1 1v16a1 1 0 1 0 2 0v-7h9v7a1 1 0 1 0 2 0V4a1 1 0 1 0-2 0v7H3V4a1 1 0 0 0-1-1Zm21 14.296c0-.51-.108-.998-.324-1.461a2.923 2.923 0 0 0-.877-1.044c.377-.297.65-.63.816-1.001.17-.44.252-.886.252-1.348a3.48 3.48 0 0 0-.943-2.385C21.274 9.363 20.398 9.01 19.31 9a3.179 3.179 0 0 0-2.251.932c-.349.336-.848.879-.848 1.384a1 1 0 0 0 1 1c.482 0 .767-.352 1.043-.692l.09-.11c.057-.07.121-.132.192-.185.256-.2.53-.296.834-.296.431.01.779.144 1.049.405.267.267.406.61.415 1.04 0 .417-.133.75-.4 1.008-.335.335-.766.387-1.212.387a.958.958 0 1 0 0 1.917h.088c.452-.002.824-.003 1.205.353.29.277.442.674.452 1.201-.01.51-.16.894-.451 1.162-.296.296-.65.44-1.076.44-.4 0-.712-.107-.944-.316l-.008-.008a8.055 8.055 0 0 1-.213-.207c-.1-.099-.178-.207-.254-.31-.193-.264-.366-.5-.81-.5a1 1 0 0 0-1 1c0 .574.543 1.19.954 1.533.635.53 1.35.84 2.174.84 1.057-.01 1.93-.35 2.609-1.018.69-.651 1.04-1.545 1.052-2.664Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphOrderedList: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M4.577 1.809a.543.543 0 0 0-.819-.469l-.502.296-.004.003-.309.187c-.342.207-.858.519-1.142.701a.573.573 0 0 0-.261.485c0 .482.544.774.948.522.227-.141.465-.287.642-.395v3.478a.723.723 0 1 0 1.447 0V1.81Zm-.899 7.128c-1.233 0-2.056.817-2.056 1.84a.25.25 0 0 0 .25.251h.891a.259.259 0 0 0 .26-.259c0-.32.227-.589.608-.589a.62.62 0 0 1 .428.15.52.52 0 0 1 .16.396c0 .315-.188.579-.538.949l-1.815 1.968a.672.672 0 0 0 .494 1.127h3.003a.63.63 0 0 0 0-1.26H3.744l.933-1.047c.61-.652.99-1.127.99-1.834a1.57 1.57 0 0 0-.563-1.226c-.356-.3-.852-.466-1.426-.466Zm.015 7.429c-1.006 0-1.692.478-1.946 1.178a.541.541 0 0 0 .107.553c.122.137.307.22.503.22a.773.773 0 0 0 .478-.18c.125-.098.23-.222.312-.33.096-.124.257-.224.511-.224.21 0 .37.063.472.152a.46.46 0 0 1 .16.359v.002a.503.503 0 0 1-.165.391.71.71 0 0 1-.483.16h-.14a.606.606 0 1 0 0 1.213h.168c.275 0 .468.074.59.178a.538.538 0 0 1 .186.42.554.554 0 0 1-.185.435c-.122.107-.314.184-.583.184-.32 0-.528-.114-.644-.264a1.776 1.776 0 0 0-.308-.323.766.766 0 0 0-.47-.174.678.678 0 0 0-.504.22.549.549 0 0 0-.114.55c.244.717.926 1.22 2.012 1.22.602 0 1.161-.168 1.575-.478.416-.311.683-.768.676-1.323-.01-.69-.376-1.122-.793-1.332.34-.231.63-.644.621-1.224-.019-.962-.92-1.583-2.036-1.583ZM8 4a1 1 0 0 1 1-1h13a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 8a1 1 0 0 1 1-1h13a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 8a1 1 0 0 1 1-1h13a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphBulletList: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M3.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM9 3a1 1 0 0 0 0 2h13a1 1 0 1 0 0-2H9Zm0 8a1 1 0 1 0 0 2h13a1 1 0 1 0 0-2H9Zm-1 9a1 1 0 0 1 1-1h13a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm-3-8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphTaskList: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M17.207 10.207a1 1 0 0 0-1.414-1.414L11 13.586l-2.293-2.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l5.5-5.5Z"
      fill={fill}
    />
    <path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2 0v16h16V4H4Z" fill={fill} />
  </FsFill>
);

export const SlashGlyphCode: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M7.856 1.753c.49 0 .888.447.888.938 0 .49-.398.84-.888.84h-.644c-.844 0-1.244.46-1.244 1.425v4.301c0 1.086-.41 1.892-1.219 2.407-.23.147-.239.543-.01.694.815.542 1.23 1.33 1.23 2.385v4.322c0 .922.399 1.405 1.243 1.405h.644c.49 0 .888.423.888.914 0 .49-.398.863-.888.863H6.812c-.977 0-1.732-.33-2.266-.944-.488-.57-.733-1.36-.733-2.325v-4.126c0-.636-.133-1.097-.4-1.382-.164-.185-.857-.323-1.494-.418-.531-.08-.933-.523-.923-1.06.01-.533.403-.98.93-1.06.633-.095 1.325-.23 1.488-.402.266-.307.4-.768.4-1.383V5.044c0-.987.244-1.777.732-2.348.534-.636 1.289-.943 2.266-.943h1.044Zm8.434 20.494c-.49 0-.888-.447-.888-.938 0-.49.397-.84.888-.84h.644c.844 0 1.244-.46 1.244-1.425v-4.301c0-1.086.41-1.892 1.219-2.407.23-.147.238-.543.01-.694-.816-.542-1.23-1.33-1.23-2.385V4.935c0-.922-.4-1.405-1.243-1.405h-.644c-.49 0-.888-.423-.888-.914 0-.49.397-.863.888-.863h1.044c.977 0 1.732.33 2.265.944.489.57.733 1.36.733 2.325v4.126c0 .636.134 1.097.4 1.382.16.18.764.32 1.343.419.53.09.932.533.922 1.07a1.1 1.1 0 0 1-.929 1.063c-.575.092-1.177.22-1.336.388-.266.307-.4.768-.4 1.382v4.104c0 .987-.244 1.777-.733 2.348-.533.636-1.288.943-2.265.943H16.29Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphQuote: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M6.865 21C4.275 21 2 18.88 2 15.037c0-4.5 3.143-9.725 6.518-12.422a.888.888 0 0 1 1.203.107c.398.424.32 1.11-.112 1.5-2.412 2.17-5.32 6.855-5.153 9.055.215-.113 1.277-.516 2.801-.516 2.197 0 3.845 1.726 3.845 4.002A4.22 4.22 0 0 1 6.865 21Zm10.898 0c-2.59 0-4.865-2.119-4.865-5.963 0-4.5 3.143-9.725 6.518-12.422a.888.888 0 0 1 1.203.107c.398.424.32 1.11-.112 1.5-2.412 2.17-5.32 6.855-5.153 9.055.215-.113 1.277-.516 2.801-.516 2.197 0 3.845 1.726 3.845 4.002A4.22 4.22 0 0 1 17.763 21Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphDivider: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M9.5 4a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm0 16a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1ZM3 11a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm14-7a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm1 15a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3ZM2 4a1 1 0 0 1 1-1h3a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1Zm1 15a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H3Z"
      fill={fill}
    />
  </FsFill>
);

/** 基础区九宫格示意：面板「表格」DataSheetOutlined */
export const SlashGlyphGridBoard: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M19.5 4.25v15.5H4V4.25h15.5ZM4 2.25a2 2 0 0 0-2 2v15.5a2 2 0 0 0 2 2h15.5a2 2 0 0 0 2-2V4.25a2 2 0 0 0-2-2H4Z"
      fill={fill}
    />
    <path
      d="M9.997 4.25v3.835H19.5v2H9.997v3.83H19.5v2H9.997v3.835h-2v-3.835H4v-2h3.997v-3.83H4v-2h3.997V4.25h2Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphLink: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M18.849 2.699a5.037 5.037 0 0 0-7.1.97L8.97 7.372a4.784 4.784 0 0 0 .957 6.699l.972.729a1 1 0 0 0 1.2-1.6l-.972-.73a2.784 2.784 0 0 1-.557-3.898l2.777-3.703a3.037 3.037 0 1 1 4.8 3.72l-1.429 1.786a1 1 0 1 0 1.562 1.25l1.43-1.788a5.037 5.037 0 0 0-.862-7.138Z"
      fill={fill}
    />
    <path
      d="M5.152 21.301a5.037 5.037 0 0 0 7.1-.97l2.777-3.703a4.784 4.784 0 0 0-.957-6.699L13.1 9.2a1 1 0 0 0-1.2 1.6l.973.73a2.784 2.784 0 0 1 .556 3.898l-2.777 3.703a3.037 3.037 0 1 1-4.8-3.72l1.429-1.786a1 1 0 0 0-1.562-1.25l-1.43 1.787a5.037 5.037 0 0 0 .863 7.14Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphImage: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="m10.141 17.988-4.275-.01a.3.3 0 0 1-.212-.512l4.133-4.133a.4.4 0 0 1 .566 0l1.907 1.907 5.057-5.057a.4.4 0 0 1 .683.283V17.7a.3.3 0 0 1-.3.3h-7.476a.301.301 0 0 1-.083-.012ZM4 22c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4Zm0-2h16V4H4v16ZM6 6h3v3H6V6Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphFolder: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M12.304 7.315a1 1 0 0 1 1.414 1.414L8.13 14.317a1.485 1.485 0 0 0 0 2.1l.01.011a1.5 1.5 0 0 0 2.117-.005l7.43-7.43a3.5 3.5 0 0 0 0-4.95l-.036-.037a3.5 3.5 0 0 0-4.95 0l-7.778 7.777a5.521 5.521 0 0 0 7.808 7.809l7.07-7.07a1 1 0 0 1 1.415 1.414l-7.07 7.07A7.521 7.521 0 0 1 3.509 10.37l7.778-7.778a5.5 5.5 0 0 1 7.778 0l.037.037a5.5 5.5 0 0 1 0 7.778l-7.43 7.43a3.5 3.5 0 0 1-4.939.012l-.006-.006-.012-.012a3.485 3.485 0 0 1 0-4.928l5.589-5.588Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphTable: SlashIcon = SlashGlyphGridBoard;

export const SlashGlyphColumns: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M11 5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V5ZM4 5h5v14H4V5Zm18 0a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V5Zm-7 0h5v14h-5V5Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphHighlight: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M4 2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4Zm16 2v6H4V4h16ZM3 16a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H4Z"
      fill={fill}
    />
  </FsFill>
);

const SYNC_BLOCKS_PATH =
  'M14 5H3v8h3v2H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v8a2 2 0 01-2 2h-2v-2h2V5zm-4 4h2v2h-2v8h11v-8h-3V9h3a2 2 0 012 2v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-8a2 2 0 012-2z';

/** 基础区栅格单色，与飞书面板一致 */
export const SlashGlyphSyncMuted: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} className={className}>
    <path d={SYNC_BLOCKS_PATH} fill={fill} />
  </FsFill>
);

export const SlashGlyphSync: SlashIcon = ({ size = 18, className }) => {
  const uid = useId().replace(/:/g, '');
  const gid = `slash-sync-grad-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#165dff" />
          <stop offset="50%" stopColor="#4080ff" />
          <stop offset="100%" stopColor="#94bfff" />
        </linearGradient>
      </defs>
      <path d={SYNC_BLOCKS_PATH} fill={`url(#${gid})`} />
    </svg>
  );
};

export const SlashGlyphButton: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path d="M21 6.133H3V16.8h9.662l1.214 3.2H3c-1.105 0-2-.955-2-2.133V6.133C1 4.955 1.895 4 3 4h18c1.105 0 2 .955 2 2.133v7.786l-2-.91V6.132Z" fill={fill} />
    <path
      d="M23.172 18.16a1 1 0 0 0 .182-1.883l-8.366-3.808a1 1 0 0 0-1.35 1.265l3.26 8.595a1 1 0 0 0 1.89-.06l1.018-3.307 3.366-.802Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphFormula: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="m15.605 7.927 2.071 3.042-1.83 2.627-.01.013c-.082.113-.188.26-.393.384-.206.125-.535.243-1.076.243h-.3v.96h.466c-.124.562-.272.936-.519 1.187-.282.287-.75.465-1.669.465h-1.58c-.137 0-.223-.005-.279-.014h-.003a1.986 1.986 0 0 1-.004-.15v-2.789h.765c.575 0 .767.099.85.2a.594.594 0 0 1 .108.282c.026.146.034.333.034.577v.3h.9v-3.666h-.9v.3c0 .244-.008.43-.034.575a.577.577 0 0 1-.107.277c-.083.099-.274.195-.85.195h-.765V10.46c0-.071 0-.117.003-.15h.003c.056-.01.142-.014.28-.014h1.531c.896 0 1.319.16 1.56.423.257.281.379.748.475 1.565l.032.264h.907l-.413-3.2H9.352L9.126 6.77H1.29l-.265 3.2h.887l.025-.273c.042-.468.083-.823.146-1.1.064-.276.143-.444.242-.555.191-.216.55-.324 1.467-.324.108 0 .236 0 .351.003.124.003.206.009.237.015h.006c.003.036.003.08.003.146v6.096a.963.963 0 0 1-.007.167.772.772 0 0 1-.26.061c-.158.02-.38.03-.69.03h-.778v.982l.321-.023c.477-.034 1.671-.034 2.228-.034.557 0 1.775 0 2.252.034l.322.023v-.982h-.779c-.31 0-.531-.01-.69-.03a.772.772 0 0 1-.26-.06.963.963 0 0 1-.006-.168V7.883a2.15 2.15 0 0 1 .003-.15 3.18 3.18 0 0 1 .224-.011c.122-.003.256-.003.37-.003.907 0 1.263.107 1.453.32.098.11.178.276.24.548.049.205.084.454.116.76h-.853v.949h.575a3.9 3.9 0 0 1 .495.023.562.562 0 0 1 .141.033c.007.032.01.083.01.19v6.06c0 .107-.003.158-.01.19a.565.565 0 0 1-.14.033 3.94 3.94 0 0 1-.496.023h-.575v.96h7.422l.44-2.612h2.059v-.954l-.294-.006c-.428-.01-.46-.227-.46-.235v-.003a2.313 2.313 0 0 1 .053-.084l.015-.023 1.437-2.066 1.594 2.33a1.102 1.102 0 0 1-.427.08l-.293.007v.98l.325-.027c.403-.034 1.26-.034 1.71-.034.498 0 1.044.011 1.541.034l.314.015v-.974h-.527c-.312 0-.484-.017-.603-.058-.098-.034-.176-.09-.275-.23v-.002l-2.394-3.518 1.519-2.152.003-.005c.108-.159.239-.304.448-.415.214-.113.532-.202 1.03-.208l.297-.003V6.7H19.08v.941l.293.007c.394.01.45.199.45.234l-.001.014a1.847 1.847 0 0 1-.034.052l-.022.033-1.113 1.593-1.266-1.843c.081-.039.22-.078.42-.083l.294-.007v-.968l-.326.028c-.39.034-1.247.034-1.709.034a37.03 37.03 0 0 1-1.54-.035l-.315-.016v.964h.527c.326 0 .501.022.615.064.094.033.162.086.25.213l.002.002Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphTemplate: SlashIcon = ({ size = 18, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <path
      d="m14.757 12.797 4.037 6.998h-8.075l4.038-6.998Zm.866-2.5a1 1 0 0 0-1.733 0l-5.768 9.998a1 1 0 0 0 .866 1.5h11.537a1 1 0 0 0 .866-1.5l-5.768-9.999Z"
      fill="#F76964"
    />
    <path
      d="m20.284 5.43-7.702-2.065-1.3 4.848A6.477 6.477 0 0 0 9.458 7.3l1.193-4.451a2 2 0 0 1 2.45-1.415l7.702 2.064a2 2 0 0 1 1.414 2.45l-2.064 7.703a2 2 0 0 1-1.744 1.474l-1.325-2.297 1.137.305 2.064-7.703Z"
      fill="#FFC60A"
    />
    <path
      d="M9.815 17.36A4.5 4.5 0 1 1 12 13.573l1.495-2.592A6.502 6.502 0 0 0 1 13.5a6.5 6.5 0 0 0 7.322 6.449l1.493-2.59Z"
      fill="#616AE5"
    />
  </svg>
);

/** 飞书「子文档」面板 18×18 */
export const SlashGlyphSubDoc: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <path
      d="M14.25 2.25H3.75v13.5H7.5v1.5H3.75a1.5 1.5 0 01-1.5-1.5V2.25a1.5 1.5 0 011.5-1.5h10.5a1.5 1.5 0 011.5 1.5v6h-1.5v-6z"
      fill={fill}
    />
    <path
      d="M5.25 5.813a.75.75 0 01.75-.75h6a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75zM6 8.813a.75.75 0 000 1.5h6a.75.75 0 000-1.5H6zM14.25 11.25a.75.75 0 00-1.5 0v2.25H10.5a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0V15h2.25a.75.75 0 000-1.5h-2.25v-2.25z"
      fill={fill}
    />
  </svg>
);

/** 多维表格 · 表格视图 BitablegridOutlined */
export const SlashGlyphBitableGrid: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm7.5 0v4H20V4H9.5Zm0 6v4H20v-4H9.5Zm-2 4v-4H4v4h3.5ZM4 16v4h3.5v-4H4Zm5.5 0v4H20v-4H9.5Zm-2-12H4v4h3.5V4Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphKanban: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M4 16.5h4V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7.5h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10.5a2 2 0 0 0 2 2ZM8 4v10.5H4V4h4Zm6 0v16h-4V4h4Zm2 6.5V4h4v6.5h-4Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphGantt: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M8.5 3.425v2.05h12v-2.05h-12Zm7.51 11.6c.824-.005 1.49-.755 1.49-1.505v-3.045c0-.728-.672-1.475-1.5-1.5H3c-.828.025-1.5.747-1.5 1.5v3.045c0 .754.672 1.505 1.5 1.505h13.01Zm-8.013 1.5h-.01a1.5 1.5 0 0 0-1.49 1.5v3.05a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-3.05a1.5 1.5 0 0 0-1.5-1.5h-13ZM3.5 10.975h12v2.05h-12v-2.05Zm4.997 7.55h12v2.05h-12v-2.05ZM6.5 2.925a1.5 1.5 0 0 1 1.5-1.5h13a1.5 1.5 0 0 1 1.5 1.5v3.05a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5v-3.05Z"
      fill={fill}
    />
  </FsFill>
);

export const SlashGlyphGallery: SlashIcon = ({ size = 18, fill = 'currentColor', className }) => (
  <FsFill size={size} fill={fill} className={className}>
    <path
      d="M2 4a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2 0v5h5V4H4ZM2 15a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Zm2 0v5h5v-5H4ZM15 2a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-5Zm5 2v5h-5V4h5Zm-7 11a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5Zm2 0v5h5v-5h-5Z"
      fill={fill}
    />
  </FsFill>
);
