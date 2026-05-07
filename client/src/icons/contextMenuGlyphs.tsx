import type { ComponentType, ReactNode } from 'react';

/** 与 ContextMenu 中 DocIcon 一致 */
export type CtxMenuIconProps = {
  theme?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
};

function FillSvg({
  size = 16,
  fill = 'currentColor',
  className,
  children,
}: CtxMenuIconProps & { children: ReactNode }) {
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

/** 飞书块工具栏 flatten-item：`color-b-500` / `color-i-500` 等在 Web 侧的近似色值 */
export const FEISHU_TOOLBOX = {
  /** color-b-500 */
  b500: '#3370ff',
  /** color-i-500 */
  i500: '#505968',
  /** color-g-500 */
  g500: '#34c724',
  /** color-o-500 */
  o500: '#fa8c16',
  /** icon / text n1 */
  n1: '#1f2329',
} as const;

/** TextOutlined · 正文 */
export const ContextGlyphText: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M2 3a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V4h-7v16h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3V4H4v3a1 1 0 1 1-2 0V3Z"
      fill={fill}
    />
  </FillSvg>
);

/** LinkRecordOutlined 单色双路径（工具箱） */
export const ContextGlyphSynced: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M14 5H3v8h3v2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v-2h2V5Z"
      fill={fill}
    />
    <path
      d="M10 9h2v2h-2v8h11v-8h-3V9h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
      fill={fill}
    />
  </FillSvg>
);

/** TypographyOutlined · 缩进和对齐 */
export const ContextGlyphTypography: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M2 4a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm-1 5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z"
      fill={fill}
    />
  </FillSvg>
);

/** StyleSetOutlined · 颜色 */
export const ContextGlyphStyleColor: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M21.957 2.13a1 1 0 0 0-1.406.147l-9.11 11.25a6.632 6.632 0 0 0-1.367 2.969.221.221 0 0 0 .302.244 6.632 6.632 0 0 0 2.62-1.955l9.109-11.25a1 1 0 0 0-.148-1.406Z"
      fill={fill}
    />
    <path
      d="M17.008 3.665a13.454 13.454 0 0 0-5.06-.984l-.024.004-.538.011-.51.03c-1.191.091-2.37.343-3.51.75a12.305 12.305 0 0 0-3.754 2.142c-1.096.922-1.96 1.99-2.568 3.176a8.435 8.435 0 0 0-.96 3.885c0 1.335.324 2.63.962 3.848.608 1.157 1.474 2.195 2.573 3.083a12.303 12.303 0 0 0 3.755 2.049c1.444.494 2.981.745 4.563.745l.545-.01.525-.029a14.43 14.43 0 0 0 1.57-.203l.722-.148.196-.06c.514-.186.96-.566 1.253-1.083a2.87 2.87 0 0 0 .26-2.178l-.09-.349-.03-.218a2.301 2.301 0 0 1 .357-1.454c.357-.544.93-.868 1.538-.871h1.768l.204-.007c1.614-.113 2.91-1.56 3.007-3.365l.006-.22-.006-.24-.05-.432-.067-.404a8.844 8.844 0 0 0-1.236-3.08 10.13 10.13 0 0 0-.802-1.096l-1.199 1.48c.154.2.298.406.43.617.483.76.81 1.563.974 2.393l.06.358.032.276.003.086-.007.22-.021.169c-.12.724-.604 1.301-1.19 1.38l-.138.01h-1.77l-.247.008c-1.14.079-2.192.702-2.847 1.7a4.145 4.145 0 0 0-.574 3.156l.068.273.037.13.028.154a.993.993 0 0 1-.118.588.58.58 0 0 1-.248.247l-.07.021-.67.134-.549.085a12.6 12.6 0 0 1-1.657.11 12.18 12.18 0 0 1-3.961-.647 10.426 10.426 0 0 1-3.19-1.734c-.9-.729-1.606-1.57-2.096-2.5a6.38 6.38 0 0 1-.75-2.984c0-1.037.254-2.06.755-3.034.495-.963 1.206-1.839 2.11-2.6A10.494 10.494 0 0 1 7.99 5.235a11.42 11.42 0 0 1 3.41-.677l.538-.01.496.01c1.153.048 2.281.264 3.338.633l1.236-1.526Z"
      fill={fill}
    />
    <path d="M6.875 14.466a1.377 1.377 0 0 0-1.374-1.374 1.375 1.375 0 0 0 0 2.747c.758 0 1.374-.616 1.374-1.373ZM8.124 9.47a1.375 1.375 0 0 0-2.748 0 1.374 1.374 0 1 0 2.748 0Zm5.246-1.874a1.374 1.374 0 1 0-2.747-.001 1.374 1.374 0 0 0 2.747 0Z" fill={fill} />
  </FillSvg>
);

/** FeishuclipOutlined · 剪切 */
export const ContextGlyphCut: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M4.801 4.906a2.289 2.289 0 0 1-.167-2.686c.202-.315.636-.274.875.013l6.571 7.925 6.571-7.925c.239-.287.673-.328.875-.013a2.29 2.29 0 0 1-.167 2.686l-5.817 7.015 2.486 2.997a3.87 3.87 0 0 1 2.212-.691c2.165 0 3.92 1.776 3.92 3.966 0 2.191-1.755 3.967-3.92 3.967s-3.92-1.776-3.92-3.966a4 4 0 0 1 .279-1.473l-2.519-3.037-2.519 3.037c.18.455.279.952.279 1.473 0 2.19-1.755 3.966-3.92 3.966S2 20.384 2 18.194c0-2.191 1.755-3.967 3.92-3.967.82 0 1.582.255 2.212.691l2.486-2.997L4.8 4.906ZM18.24 19.893a1.69 1.69 0 0 0 1.68-1.7c0-.938-.752-1.7-1.68-1.7a1.69 1.69 0 0 0-1.68 1.7c0 .94.752 1.7 1.68 1.7Zm-10.64-1.7c0-.938-.752-1.7-1.68-1.7a1.69 1.69 0 0 0-1.68 1.7c0 .94.752 1.7 1.68 1.7a1.69 1.69 0 0 0 1.68-1.7Z"
      fill={fill}
    />
  </FillSvg>
);

/** CopyOutlined */
export const ContextGlyphCopy: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M9 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V4h-9a1 1 0 0 1-1-1Z"
      fill={fill}
    />
    <path d="M5 6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5Zm0 2h10v12H5V8Z" fill={fill} />
  </FillSvg>
);

/** TranslateOutlined */
export const ContextGlyphTranslate: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M18.656 9.5h1.47a8.504 8.504 0 0 0-16.252 0H1.799c1.122-4.592 5.264-8 10.201-8 4.938 0 9.079 3.408 10.2 8h1.644a.16.16 0 0 1 .156.162.166.166 0 0 1-.046.115l-2.539 2.652a.226.226 0 0 1-.33 0l-2.54-2.652a.167.167 0 0 1 0-.23.152.152 0 0 1 .11-.047Zm-13.312 5h-1.47a8.504 8.504 0 0 0 16.252 0h2.075c-1.122 4.592-5.264 8-10.201 8s-9.079-3.408-10.2-8H.155a.152.152 0 0 1-.11-.048.168.168 0 0 1 0-.23l2.539-2.65a.226.226 0 0 1 .33 0l2.54 2.65a.169.169 0 0 1 .045.116.16.16 0 0 1-.156.162Z"
      fill={fill}
    />
    <path d="M13.015 7.5H11.01l-3.51 9h2.016l1.025-2.484H13.4l1.116 2.484H16.5l-3.485-9ZM12.93 12h-1.873l.958-2.52.915 2.52Z" fill={fill} />
  </FillSvg>
);

/** DeleteTrashOutlined */
export const ContextGlyphDelete: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h5a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6H3a1 1 0 0 1 0-2h5ZM6 6v14h12V6H6Zm4 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
      fill={fill}
    />
  </FillSvg>
);

/** SharewordsOutlined */
export const ContextGlyphShare: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M21.5 5c0-.552-.473-1-1.055-1H3.555C2.974 4 2.5 4.448 2.5 5s.473 1 1.056 1h16.889c.582 0 1.055-.448 1.055-1Zm-9.617 6c.647 0 1.172.448 1.172 1s-.525 1-1.172 1h-8.21c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h8.21Zm-3.167 7c.648 0 1.173.448 1.173 1s-.525 1-1.173 1H3.673c-.648 0-1.173-.448-1.173-1s.525-1 1.173-1h5.043Zm9.077-8.242a1 1 0 0 1 1.415 0l3.535 3.535a1 1 0 0 1 0 1.415l-3.535 3.535a1 1 0 0 1-1.415-1.414l1.822-1.822c-1.819.07-3.162.64-4.065 1.543-.965.965-1.55 2.435-1.55 4.45a1 1 0 1 1-2 0c0-2.403.706-4.434 2.136-5.864 1.356-1.356 3.251-2.06 5.491-2.13l-1.834-1.834a1 1 0 0 1 0-1.414Z"
      fill={fill}
    />
  </FillSvg>
);

/** TemplateOutlined · 保存为模板（单色） */
export const ContextGlyphTemplate: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M19.482 14.763a1.99 1.99 0 0 0 .627-.998l2.07-7.727a2 2 0 0 0-1.414-2.45l-7.727-2.07a2 2 0 0 0-2.45 1.414L9.421 7.289a6.5 6.5 0 1 0-1.62 12.705C7.799 21.038 8.635 22 9.804 22h10.392c1.54 0 2.502-1.667 1.732-3l-2.446-4.237Zm.766-9.243-1.935 7.219L16.733 10c-.77-1.333-2.695-1.333-3.465 0l-.966 1.673-1.852-.496 2.07-7.728 7.728 2.071ZM8.75 17.824A4.505 4.505 0 0 1 3 13.5a4.5 4.5 0 0 1 5.903-4.277l-.385 1.436a2 2 0 0 0 1.414 2.45l1.335.357-2.516 4.358ZM15 11l5.196 9H9.804L15 11Z"
      fill={fill}
    />
  </FillSvg>
);

/** BlocklinkOutlined · 复制链接 */
export const ContextGlyphBlockLink: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path
      d="M4.15 1.7h14.894a2 2 0 0 1 2 2v2.014h-2V3.7H4.15v14.895h2.543v2H4.15a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2Zm17.57 5.954c1.9 1.594 2.296 4.415.703 6.313l-.443.528a1 1 0 1 1-1.532-1.286l.443-.528c.81-.965.687-2.536-.456-3.495-1.142-.959-2.71-.808-3.521.158l-2.487 2.963c-.638.761-.552 2.019.374 2.795l.675.567A1 1 0 1 1 14.19 17.2l-.675-.567c-1.683-1.412-2.04-3.919-.62-5.612l2.487-2.963c1.592-1.899 4.439-2 6.339-.405Zm-5.697 13.942c-1.593 1.898-4.44 1.999-6.34.404-1.9-1.594-2.294-4.415-.702-6.313l.443-.527a1 1 0 1 1 1.532 1.285l-.443.528c-.81.966-.687 2.537.456 3.495 1.143.96 2.711.808 3.521-.158l2.487-2.963c.639-.761.552-2.018-.373-2.795l-.676-.566a1 1 0 1 1 1.286-1.533l.675.567c1.683 1.412 2.04 3.92.62 5.613l-2.486 2.963Z"
      fill={fill}
    />
  </FillSvg>
);

/** NewJoinMeetingOutlined · 在下方添加 */
export const ContextGlyphAddBelow: ComponentType<CtxMenuIconProps> = ({
  size = 16,
  fill = 'currentColor',
  className,
}) => (
  <FillSvg size={size} fill={fill} className={className}>
    <path d="M11 8a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H8a1 1 0 1 1 0-2h3V8Z" fill={fill} />
    <path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2 0v16h16V4H4Z" fill={fill} />
  </FillSvg>
);
