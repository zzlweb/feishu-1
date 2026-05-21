import type { ComponentType, ReactNode } from 'react';

export type SelToolbarIconProps = {
  size?: number;
  fill?: string;
  className?: string;
};

function ToolbarSvg({
  size = 16,
  fill = 'currentColor',
  className,
  children,
}: SelToolbarIconProps & { children: ReactNode }) {
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

/** H2Outlined · 标题 / 转成 */
export const SelGlyphH2: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M2 3a1 1 0 0 0-1 1v16a1 1 0 1 0 2 0v-7h9v7a1 1 0 1 0 2 0V4a1 1 0 1 0-2 0v7H3V4a1 1 0 0 0-1-1Zm20.993 16.872c0-.561-.455-1.015-1.017-1.015h-3.121l3.407-4.272a3.35 3.35 0 0 0 .731-2.126c-.01-.992-.347-1.816-1.005-2.464-.647-.651-1.492-.984-2.523-.995-.931.011-1.72.34-2.356.982-.37.386-.941 1.044-.941 1.602 0 .591.48 1.07 1.07 1.07.563 0 .769-.347.993-.726.06-.101.12-.204.19-.304a1.36 1.36 0 0 1 .186-.214c.262-.252.584-.376.982-.376.447.01.784.15 1.02.423.234.28.35.606.35.987 0 .146-.019.303-.057.471-.05.152-.156.341-.315.548l-4.402 5.506a.4.4 0 0 0-.087.25v1.022c0 .221.267.65.606.65h5.272c.562 0 1.017-.457 1.017-1.019Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** DownBoldOutlined */
export const SelGlyphChevronDown: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="m3.414 7.086-.707.707a1 1 0 0 0 0 1.414l7.778 7.778a2 2 0 0 0 2.829 0l7.778-7.778a1 1 0 0 0 0-1.414l-.707-.707a1 1 0 0 0-1.415 0l-7.07 7.07-7.072-7.07a1 1 0 0 0-1.414 0Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** TypographyOutlined · 对齐 */
export const SelGlyphTypography: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M2 4a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm-1 5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** BoldOutlined */
export const SelGlyphBold: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M5 2.709C5 2.317 5.317 2 5.709 2h6.734a5.317 5.317 0 0 1 3.686 9.148 5.671 5.671 0 0 1-2.623 10.7H5.71a.709.709 0 0 1-.71-.707V2.71Zm2 7.798h5.443a3.19 3.19 0 0 0 3.19-3.19c0-1.762-1.428-3.317-3.19-3.317H7v6.507Zm0 2.126v7.09h6.507a3.544 3.544 0 0 0 0-7.09H7Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** HorizontalLineOutlined · 删除线 */
export const SelGlyphStrike: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M5.49 7.226A5.107 5.107 0 0 1 6.9 3.831C8.017 2.636 9.718 2 11.819 2c2.142 0 3.779.57 4.867 1.689.4.392.869.958 1.26 1.595.443.723-.191 1.53-1.04 1.53-.606 0-1.039-.447-1.326-.981a2.864 2.864 0 0 0-.362-.517c-.735-.93-1.909-1.419-3.386-1.419-2.404 0-4.154 1.395-4.2 3.393-.02.846.337 1.58.995 2.043h-2.75c-.271-.621-.403-1.332-.385-2.107Zm8.906 6.024H4.038c-.518 0-.938-.38-.938-.897 0-.518.42-.978.938-.978h16.125c.518 0 .937.437.937.954 0 .518-.42.921-.937.921h-2.455c.542.806.96 1.954.934 3.055C18.563 19.82 15.87 22 11.572 22c-2.875 0-5.028-.964-6.13-2.745a6.884 6.884 0 0 1-.545-1.191c-.261-.72.318-1.432 1.084-1.432.574 0 1.034.416 1.24.952.17.445.4.794.733 1.142.805.858 2.104 1.305 3.766 1.305 2.845 0 4.696-1.39 4.747-3.61.024-1.072-.256-1.61-.897-2.42-.473-.598-1.174-.751-1.174-.751Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** ItalicOutlined */
export const SelGlyphItalic: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M14.825 5.077 11.19 18.923h4.052a1.038 1.038 0 1 1 0 2.077H4.954a1.038 1.038 0 1 1 0-2.077h4.053l3.636-13.846H8.591A1.038 1.038 0 1 1 8.59 3h10.287a1.038 1.038 0 0 1 0 2.077h-4.053Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** UnderlineOutlined */
export const SelGlyphUnderline: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M7.361 3.052a.99.99 0 0 0-.989-.994.998.998 0 0 0-.999.994v5.765c0 4.205 2.601 7.29 6.627 7.29s6.627-3.085 6.627-7.29V3.052a.996.996 0 0 0-.996-.994.992.992 0 0 0-.992.994v5.765c0 3.003-1.763 5.302-4.639 5.302-2.876 0-4.639-2.299-4.639-5.302V3.052ZM3.054 19.42a.988.988 0 0 0-.994.988 1 1 0 0 0 .994 1h17.892a1 1 0 0 0 .994-1.002.987.987 0 0 0-.994-.986H3.054Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** GlobalLinkOutlined */
export const SelGlyphLink: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M18.849 2.699a5.037 5.037 0 0 0-7.1.97L8.97 7.372a4.784 4.784 0 0 0 .957 6.699l.972.729a1 1 0 0 0 1.2-1.6l-.972-.73a2.784 2.784 0 0 1-.557-3.898l2.777-3.703a3.037 3.037 0 1 1 4.8 3.72l-1.429 1.786a1 1 0 1 0 1.562 1.25l1.43-1.788a5.037 5.037 0 0 0-.862-7.138Z"
      fill={fill}
    />
    <path
      d="M5.152 21.301a5.037 5.037 0 0 0 7.1-.97l2.777-3.703a4.784 4.784 0 0 0-.957-6.699L13.1 9.2a1 1 0 0 0-1.2 1.6l.973.73a2.784 2.784 0 0 1 .556 3.898l-2.777 3.703a3.037 3.037 0 1 1-4.8-3.72l1.429-1.786a1 1 0 0 0-1.562-1.25l-1.43 1.787a5.037 5.037 0 0 0 .863 7.14Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** CodeOutlined */
export const SelGlyphCode: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M13.31 1.082a1 1 0 0 0-1.115.87L9.758 21.805a1 1 0 0 0 1.985.243l2.437-19.85a1 1 0 0 0-.87-1.115ZM8.207 5.293a1 1 0 0 1 0 1.414L2.414 12.5l5.793 5.793a1 1 0 1 1-1.414 1.414l-6.5-6.5a1 1 0 0 1 0-1.414l6.5-6.5a1 1 0 0 1 1.414 0Zm7.586 0a1 1 0 0 0 0 1.414l5.793 5.793-5.793 5.793a1 1 0 0 0 1.414 1.414l6.5-6.5a1 1 0 0 0 0-1.414l-6.5-6.5a1 1 0 0 0-1.414 0Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** FontcolorOutlined */
export const SelGlyphFontColor: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="m16.439 15 3.14 7.391a1 1 0 1 0 1.842-.782L13.38 2.692c-.518-1.218-2.244-1.218-2.761 0L2.58 21.609a1 1 0 1 0 1.84.782L7.563 15h8.877Zm-.85-2H8.412L12 4.557 15.59 13Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** ToolbarMoreOutlined */
export const SelGlyphToolbarMore: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M13.086 7.814a2 2 0 0 1 0-2.828l3.04-3.04a2 2 0 0 1 2.829 0l3.04 3.04a2 2 0 0 1 0 2.828l-3.04 3.04a2 2 0 0 1-2.829 0l-3.04-3.04Zm2.828-2.828L14.5 6.4l1.414 1.414.212.212 1.415 1.414 1.414-1.414.212-.212L20.58 6.4l-1.414-1.414-.212-.212-1.414-1.415-1.415 1.415-.212.212ZM4.2 2.199a2 2 0 0 0-2 2v4.5a2 2 0 0 0 2 2h4.5a2 2 0 0 0 2-2v-4.5a2 2 0 0 0-2-2H4.2Zm0 2h4.5v4.5H4.2v-4.5Zm0 9.101a2 2 0 0 0-2 2v4.5a2 2 0 0 0 2 2h4.5a2 2 0 0 0 2-2v-4.5a2 2 0 0 0-2-2H4.2Zm0 2h4.5v4.5H4.2v-4.5Zm11.1-2a2 2 0 0 0-2 2v4.501a2 2 0 0 0 2 2h4.5a2 2 0 0 0 2-2v-4.5a2 2 0 0 0-2-2h-4.5Zm0 2h4.5v4.501h-4.5v-4.5Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** SharewordsOutlined */
export const SelGlyphShare: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M21.5 5c0-.552-.473-1-1.055-1H3.555C2.974 4 2.5 4.448 2.5 5s.473 1 1.056 1h16.889c.582 0 1.055-.448 1.055-1Zm-9.617 6c.647 0 1.172.448 1.172 1s-.525 1-1.172 1h-8.21c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h8.21Zm-3.167 7c.648 0 1.173.448 1.173 1s-.525 1-1.173 1H3.673c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h5.043Zm9.077-8.242a1 1 0 0 1 1.415 0l3.535 3.535a1 1 0 0 1 0 1.415l-3.535 3.535a1 1 0 0 1-1.415-1.414l1.822-1.822c-1.819.07-3.162.64-4.065 1.543-.965.965-1.55 2.435-1.55 4.45a1 1 0 1 1-2 0c0-2.403.706-4.434 2.136-5.864 1.356-1.356 3.251-2.06 5.491-2.13l-1.834-1.834a1 1 0 0 1 0-1.414Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** MergeCellsOutlined · 合并单元格 */
export const SelGlyphTableMerge: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M4 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4Zm0 2h7v6H4V4Zm9 0h7v6h-7V4ZM4 12h16v4H4v-4Zm0 6h7v2H4v-2Zm9 0h7v2h-7v-2Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** PaintOutlined · 单元格背景色 */
export const SelGlyphTableCellBg: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M16.293 2.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-9 9A1 1 0 0 1 12 17H8a1 1 0 0 1-1-1v-4a1 1 0 0 1 .293-.707l9-9ZM9 12.414V15h2.586l8-8L17 4.414l-8 8ZM3 19a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** DeleteOutlined · 删除 */
export const SelGlyphDelete: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6H4a1 1 0 1 1 0-2h5V3Zm2 0v1h2V3h-2ZM6 6v14h12V6H6Zm3 3a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1Zm3 0a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1Zm3 0a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1Z"
      fill={fill}
    />
  </ToolbarSvg>
);

/** AddCommentOutlined */
export const SelGlyphComment: ComponentType<SelToolbarIconProps> = ({
  size,
  fill = 'currentColor',
  className,
}) => (
  <ToolbarSvg size={size} fill={fill} className={className}>
    <path
      d="M7 11a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"
      fill={fill}
    />
    <path
      d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.812a.5.5 0 0 0-.33.124l-2.541 2.224a2 2 0 0 1-2.634 0l-2.542-2.224a.5.5 0 0 0-.329-.124H4a2 2 0 0 1-2-2V5Zm2 0v11.5h3.812a2.5 2.5 0 0 1 1.646.619L12 19.343l2.542-2.224a2.5 2.5 0 0 1 1.646-.619H20V5H4Z"
      fill={fill}
    />
  </ToolbarSvg>
);
