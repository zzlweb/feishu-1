import type { CSSProperties } from 'react';

export type FeishuIconProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

/** 与飞书文档 Web 中 HomeOutlined 一致的 24×24 路径 */
export function IconHomeOutlined({ size = 24, color = 'currentColor', className, style }: FeishuIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="m20 10-8-5.939L4 10v10h5v-3.8a2.2 2.2 0 0 1 2.2-2.2h1.6a2.2 2.2 0 0 1 2.2 2.2V20h5V10Zm-9 11a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .75-1.562l8-5.938a2 2 0 0 1 2.5 0l8 5.938A2 2 0 0 1 22 10v10a2 2 0 0 1-2 2h-6a1 1 0 0 1-1-1v-4.8a.2.2 0 0 0-.2-.2h-1.6a.2.2 0 0 0-.2.2V21Z"
        fill={color}
      />
    </svg>
  );
}

/** ChatPinOutlined 置顶图钉 */
export function IconChatPinOutlined({ size = 24, color = 'currentColor', className, style }: FeishuIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M6.32 1.5c-.625 0-1.022.478-1.022 1.03 0 .534.487.973 1.022.97l1.692.003v4.526c0 .134-.113.264-.208.36l-4.156 4.77a.508.508 0 0 0-.147.358l-.001.803a1 1 0 0 0 1.01 1.012l6.482.001.007 6.6a1 1 0 0 0 1 .998h.021a1 1 0 0 0 1-1v-6.597l6.48-.002c.55 0 1-.452.999-1.012l.001-.804a.51.51 0 0 0-.15-.36l-4.144-4.769c-.092-.092-.186-.221-.186-.356V3.505l1.69-.005c.71 0 1.024-.603 1.024-.98 0-.616-.484-1.02-1.024-1.02H6.32Zm3.737 2.002L14.06 3.5l.006 5.419 3.826 4.416-11.698-.003L10.06 8.9l-.003-5.398Z"
        fill={color}
      />
    </svg>
  );
}

/** 次级菜单右侧小三角（与飞书插入面板一致） */
export function IconChevronMenuEnd({ size = 14, color = '#8f959e', className, style }: FeishuIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M5.5 3.5 10.5 8 5.5 12.5"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 飞书文档 AddOutlined — 段落旁「添加」面板触发图标 */
export function IconAddOutlined({ size = 24, color = 'currentColor', className, style }: FeishuIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-icon="AddOutlined"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M12 2a1 1 0 0 0-1 1v8H3a1 1 0 1 0 0 2h8v8a1 1 0 1 0 2 0v-8h8a1 1 0 1 0 0-2h-8V3a1 1 0 0 0-1-1Z"
        fill={color}
      />
    </svg>
  );
}

/** 块左侧六点拖动把手（紧凑六点，用于空间极窄处） */
export function IconBlockDragHandle({ size = 14, color = '#646a73', className, style }: FeishuIconProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 10) / 6)}
      viewBox="0 0 6 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="1.5" cy="1.5" r="0.9" fill={color} />
      <circle cx="4.5" cy="1.5" r="0.9" fill={color} />
      <circle cx="1.5" cy="5" r="0.9" fill={color} />
      <circle cx="4.5" cy="5" r="0.9" fill={color} />
      <circle cx="1.5" cy="8.5" r="0.9" fill={color} />
      <circle cx="4.5" cy="8.5" r="0.9" fill={color} />
    </svg>
  );
}

/** 飞书文档 DragOutlined — 行旁块菜单右侧六点柄（24×24 视口） */
export function IconDragOutlined({
  size = 16,
  color = 'currentColor',
  className,
  style,
}: FeishuIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-icon="DragOutlined"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M8.25 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm0 7.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm1.75 5.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0ZM14.753 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM16.5 12a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm-1.747 9a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
        fill={color}
      />
    </svg>
  );
}
