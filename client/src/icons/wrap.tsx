import type { IconProps } from 'tdesign-icons-react';
import type { ForwardRefExoticComponent, FC, RefAttributes } from 'react';

export type TDesignSvgIcon = ForwardRefExoticComponent<
  IconProps & RefAttributes<SVGElement>
>;

/** 兼容原先 Icon Park 的 props（theme 已忽略） */
export type ParkCompatIconProps = {
  theme?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
};

export function wrapIcon(Icon: TDesignSvgIcon): FC<ParkCompatIconProps> {
  return function ParkCompatIcon({
    size = 18,
    strokeWidth = 2,
    fill = 'currentColor',
    className,
  }) {
    return (
      <Icon
        size={`${size}px` as IconProps['size']}
        strokeWidth={strokeWidth}
        strokeColor={fill}
        className={className}
      />
    );
  };
}
