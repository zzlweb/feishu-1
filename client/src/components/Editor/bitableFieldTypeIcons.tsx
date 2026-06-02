import type { BaseField } from './bitableModel';

interface GlyphProps {
  size?: number;
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  } as const;
}

function FeishuPaths({ size = 16, paths }: GlyphProps & { paths: string[] }) {
  return (
    <svg {...svgProps(size)}>
      {paths.map((d, index) => (
        <path key={index} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

/** StyleOutlined · 文本 */
function FieldTypeGlyphText(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M8.437 4.898 5.447 13h6.063L8.437 4.898Zm6.025 15.881L12.269 15h-7.56l-2.131 5.78a1 1 0 1 1-1.873-.703L7.02 2.982c.491-1.31 2.344-1.31 2.835 0l6.48 17.095a1 1 0 1 1-1.872.702ZM15.056 5a1 1 0 1 0 0 2H23a1 1 0 1 0 0-2h-7.944Zm1.055 7a1 1 0 0 1 1-1H23a1 1 0 1 1 0 2h-5.89a1 1 0 0 1-1-1Zm3.056 5a1 1 0 1 0 0 2H23a1 1 0 1 0 0-2h-3.833Z',
      ]}
    />
  );
}

/** DownRoundOutlined · 单选 */
function FieldTypeGlyphSingleSelect(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M7.755 11.658a1 1 0 0 1 1.416-1.415L12 13.07l2.828-2.829a1 1 0 0 1 1.416 1.416c-1.181 1.189-2.356 2.386-3.553 3.56a.987.987 0 0 1-1.383 0c-1.196-1.175-2.371-2.371-3.553-3.56Z',
        'M12 23C5.925 23 1 18.075 1 12S5.925 1 12 1s11 4.925 11 11-4.925 11-11 11Zm0-2a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
      ]}
    />
  );
}

/** GroupSelectionOutlined · 多选 */
function FieldTypeGlyphMultiSelect(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M6.707 3.707a1 1 0 0 0-1.414-1.414L3 4.586l-.793-.793A1 1 0 0 0 .793 5.207l1.5 1.5a1 1 0 0 0 1.414 0l3-3ZM10 3a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2H10Zm0 8a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H10Zm0 8a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H10Zm-3.293-.293a1 1 0 1 0-1.414-1.414L3 19.586l-.793-.793a1 1 0 0 0-1.414 1.414l1.5 1.5a1 1 0 0 0 1.414 0l3-3Zm0-8.914a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0l-1.5-1.5a1 1 0 1 1 1.414-1.414l.793.793 2.293-2.293a1 1 0 0 1 1.414 0Z',
      ]}
    />
  );
}

/** TodoOutlined · 复选框 */
function FieldTypeGlyphCheckbox(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M17.207 10.207a1 1 0 0 0-1.414-1.414L11 13.586l-2.293-2.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l5.5-5.5Z',
        'M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2 0v16h16V4H4Z',
      ]}
    />
  );
}

/** CalendarLineOutlined · 日期 */
function FieldTypeGlyphDate(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M7 2a1 1 0 0 1 1 1h8a1 1 0 1 1 2 0h2a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2a1 1 0 0 1 1-1Zm9 3H8a1 1 0 0 1-2 0H4v15h16V5h-2a1 1 0 1 1-2 0ZM9 15a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1Zm1.5-5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1Zm3 5a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1Zm1.5 0a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1Zm3-5a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1Z',
      ]}
    />
  );
}

/** CalendarAddOutlined · 创建时间 */
function FieldTypeGlyphCreatedTime(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M8 3a1 1 0 0 0-2 0H4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9v-2H4v-9h18V5a2 2 0 0 0-2-2h-2a1 1 0 1 0-2 0H8Zm12 6H4V5h2a1 1 0 0 0 2 0h8a1 1 0 1 0 2 0h2v4Z',
        'M18 15a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2Z',
      ]}
    />
  );
}

/** CalendarEditOutlined · 最后更新时间 */
function FieldTypeGlyphUpdatedTime(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M8 3a1 1 0 0 0-2 0H4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10v-2H4v-9h18V5a2 2 0 0 0-2-2h-2a1 1 0 1 0-2 0H8Zm12 6H4V5h2a1 1 0 0 0 2 0h8a1 1 0 1 0 2 0h2v4Zm1.317 4.487a.5.5 0 0 0-.683.183l-3.75 6.495 1.732 1 3.75-6.495a.5.5 0 0 0-.183-.683l-.866-.5Zm-5.067 9.776 1.866-1.232-1.732-1-.134 2.232Z',
      ]}
    />
  );
}

/** AttachmentOutlined · 附件 */
function FieldTypeGlyphAttachment(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M12.304 7.315a1 1 0 0 1 1.414 1.414L8.13 14.317a1.485 1.485 0 0 0 0 2.1l.01.011a1.5 1.5 0 0 0 2.117-.005l7.43-7.43a3.5 3.5 0 0 0 0-4.95l-.036-.037a3.5 3.5 0 0 0-4.95 0l-7.778 7.777a5.521 5.521 0 0 0 7.808 7.809l7.07-7.07a1 1 0 0 1 1.415 1.414l-7.07 7.07A7.521 7.521 0 0 1 3.509 10.37l7.778-7.778a5.5 5.5 0 0 1 7.778 0l.037.037a5.5 5.5 0 0 1 0 7.778l-7.43 7.43a3.5 3.5 0 0 1-4.939.012l-.006-.006-.012-.012a3.485 3.485 0 0 1 0-4.928l5.589-5.588Z',
      ]}
    />
  );
}

/** NumberOutlined · 数字 */
function FieldTypeGlyphNumber(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M8.774 2.14a1 1 0 0 1 .85 1.129L9.242 6h6.98l.423-3.01a1 1 0 1 1 1.98.279L18.242 6H22a1 1 0 1 1 0 2h-4.04l-.984 7H20a1 1 0 1 1 0 2h-3.305l-.575 4.093a1 1 0 1 1-1.98-.278L14.674 17h-6.98l-.575 4.093a1 1 0 1 1-1.98-.278L5.674 17H2a1 1 0 1 1 0-2h3.956l.984-7H4a1 1 0 1 1 0-2h3.221l.423-3.01a1 1 0 0 1 1.13-.85ZM14.956 15l.984-7H8.96l-.984 7h6.98Z',
      ]}
    />
  );
}

/** MemberOutlined · 人员 */
function FieldTypeGlyphUser(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M15 6.5a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm2 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM4 19v2h16v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4Zm-2 0a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2Z',
      ]}
    />
  );
}

/** MemberAddOutlined · 创建人 */
function FieldTypeGlyphCreatedBy(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M15.5 6.5a5 5 0 1 0-10.002.002A5 5 0 0 0 15.5 6.5Zm-5 3a3.001 3.001 0 0 1 0-6 3.001 3.001 0 0 1 0 6ZM3 19c0-.346.045-.68.125-1 .445-1.725 2.01-3 3.875-3h5.98v-2H7a6 6 0 0 0-6 6v1c0 1.1.9 2 2 2h9.954v-2H3v-1Zm15.5 3a1 1 0 0 1-1-1v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 0 1-1 1Z',
      ]}
    />
  );
}

/** MemberModifiedOutlined · 修改人 */
function FieldTypeGlyphUpdatedBy(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M16.5 6.5a5 5 0 1 0-10.002.002A5 5 0 0 0 16.5 6.5Zm-5 3a3.001 3.001 0 0 1 0-6 3.001 3.001 0 0 1 0 6ZM4.008 19c0-.346.045-.68.125-1 .445-1.725 2.01-3 3.875-3h6.517v-2H8.008a6 6 0 0 0-6 6v1c0 1.1.9 2 2 2H12.5v-2H4.008v-1Zm18.172-7.97a1.01 1.01 0 0 0-1.37.37l-.586 1.018 1.737 1.003.59-1.021c.27-.48.11-1.09-.37-1.37Zm-.719 3.257-1.736-1.002-4.265 7.405c-.09.16-.14.35-.12.54l.11 1.27c.01.04.03.07.06.09.03.01.1 0 .1 0l1.16-.53c.18-.08.33-.22.43-.39l4.261-7.383Z',
      ]}
    />
  );
}

/** GlobalLinkOutlined · 超链接 */
function FieldTypeGlyphUrl(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M18.849 2.699a5.037 5.037 0 0 0-7.1.97L8.97 7.372a4.784 4.784 0 0 0 .957 6.699l.972.729a1 1 0 0 0 1.2-1.6l-.972-.73a2.784 2.784 0 0 1-.557-3.898l2.777-3.703a3.037 3.037 0 1 1 4.8 3.72l-1.429 1.786a1 1 0 1 0 1.562 1.25l1.43-1.788a5.037 5.037 0 0 0-.862-7.138Z',
        'M5.152 21.301a5.037 5.037 0 0 0 7.1-.97l2.777-3.703a4.784 4.784 0 0 0-.957-6.699L13.1 9.2a1 1 0 0 0-1.2 1.6l.973.73a2.784 2.784 0 0 1 .556 3.898l-2.777 3.703a3.037 3.037 0 1 1-4.8-3.72l1.429-1.786a1 1 0 0 0-1.562-1.25l-1.43 1.787a5.037 5.037 0 0 0 .863 7.14Z',
      ]}
    />
  );
}

/** MailOutlined · Email */
function FieldTypeGlyphEmail(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M5.558 10.214a1 1 0 0 1 .925-1.77l5.481 2.861 5.481-2.862a1 1 0 0 1 .925 1.772l-5.887 3.074a.995.995 0 0 1-.52.112.994.994 0 0 1-.518-.112l-5.887-3.075Z',
        'M21.009 3C22.113 3 23 3.895 23 5v14c0 1.105-.888 2-1.992 2H2.99A1.993 1.993 0 0 1 1 19V5c0-1.104.888-2 1.992-2H21.01ZM21 5H3v14h18V5Z',
      ]}
    />
  );
}

/** OfficephoneOutlined · 电话号码 */
function FieldTypeGlyphPhone(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M12.858 1.6c.678 0 1.337.02 1.973.06l.628.049c.21.018.42.04.624.063l.607.078c4.183.599 6.993 2.3 7.16 5.396.108 2.033-.837 3.395-2.435 3.936a4.554 4.554 0 0 1-.706.175c.353.989.618 2.512.792 3.342.134.636.228 1.45.287 2.449l.034.693.022.748.008.394a3 3 0 0 1-2.777 3.039l-.223.008H5.142l-.223-.008a3 3 0 0 1-2.777-3.039l.008-.394.023-.748.033-.693c.059-.999.154-1.813.287-2.449.174-.83.436-2.354.789-3.343a4.535 4.535 0 0 1-.7-.174C.984 10.642.04 9.28.15 7.246c.162-3.02 2.84-4.714 6.855-5.35l.304-.046.606-.078.31-.034.315-.03.628-.047a30.04 30.04 0 0 1 1.301-.054l2.39-.007Zm3.109 6.648-.056-.314H8.087l-.008.055c-.243 1.49-.967 2.568-2.174 3.123a2.94 2.94 0 0 1-.457.162l.18-.458c-.566 1.398-.957 3.24-1.178 4.293-.111.533-.195 1.255-.247 2.16l-.019.35-.026.67-.016.725a1 1 0 0 0 .874 1.007l.118.009H18.86c.56-.009 1-.463.992-1.016l-.016-.725-.026-.67c-.051-1.072-.14-1.91-.266-2.51-.197-.938-.531-2.628-1.001-3.839a2.728 2.728 0 0 1-.45-.158c-1.136-.522-1.844-1.508-2.126-2.864Zm-1.108 7.396a1 1 0 0 1 .117 1.993l-.117.007H9.142a1 1 0 0 1-.117-1.993l.117-.007h5.717ZM12.858 3.6l-2.05.002c-5.044.056-8.536 1.391-8.662 3.752-.06 1.127.321 1.678 1.078 1.934.624.211 1.498.166 1.846.007.625-.287.985-.9 1.08-1.99A1.5 1.5 0 0 1 7.507 5.94l.136-.006h8.71a1.5 1.5 0 0 1 1.494 1.371c.094 1.09.455 1.703 1.08 1.99.347.16 1.222.204 1.846-.007.757-.256 1.139-.807 1.078-1.934-.127-2.36-3.618-3.696-8.663-3.752l-.331-.002Z',
      ]}
    />
  );
}

/** BaseFormulaOutlined · 公式 */
function FieldTypeGlyphFormula(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M12.5 1A4.5 4.5 0 0 0 8 5.5V10H4a1 1 0 1 0 0 2h4v6.5a2.5 2.5 0 0 1-5 0V18a1 1 0 1 0-2 0v.5a4.5 4.5 0 1 0 9 0V12h4a1 1 0 1 0 0-2h-4V5.5a2.5 2.5 0 0 1 5 0V6a1 1 0 1 0 2 0v-.5A4.5 4.5 0 0 0 12.5 1Zm8.884 19.879a1 1 0 0 1 1.074 1.68l-.142.108a1.667 1.667 0 0 1-2.316-.31l-1.57-1.95-1.572 1.95a1.667 1.667 0 0 1-2.315.31l-.143-.107a1 1 0 0 1 1.074-1.681l1.668-2.07-1.668-2.072a1 1 0 0 1-1.074-1.68l.143-.107a1.667 1.667 0 0 1 2.315.31l1.571 1.95L20 15.26a1.667 1.667 0 0 1 2.316-.31l.142.107a1 1 0 0 1-1.074 1.68l-1.668 2.071 1.668 2.07Z',
      ]}
    />
  );
}

/** LookupOutlined · 查找引用 */
function FieldTypeGlyphLookup(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M20 4H4v16h7v2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6h-2V4Z',
        'M7 6.5a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H7Zm-1 5a1 1 0 0 1 1-1h3.5a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2H7Zm13.939 4.58a5 5 0 1 0-1.522 1.298l1.698 1.953a1 1 0 0 0 1.51-1.312l-1.686-1.939ZM17 19a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z',
      ]}
    />
  );
}

/** SheetDatareferenceOutlined · 双向关联 */
function FieldTypeGlyphRelation(props: GlyphProps) {
  return (
    <FeishuPaths
      {...props}
      paths={[
        'M12 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V4Zm2 0v6h6V4h-6ZM2 14a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Zm2 0v6h6v-6H4Zm17 .993V17a5 5 0 0 1-5 5h-1a1 1 0 1 1 0-2h1a3 3 0 0 0 2.987-2.724l-1.453-.161a.5.5 0 0 1-.298-.85l2.91-2.911a.5.5 0 0 1 .854.353v1.286ZM3 9.02V7a5 5 0 0 1 5-5h1a1 1 0 0 1 0 2H8a3 3 0 0 0-2.986 2.701l1.86.186a.5.5 0 0 1 .285.87l-3.325 2.992A.5.5 0 0 1 3 10.377V9.02Z',
      ]}
    />
  );
}

/** LockOutlined · 主字段锁（线性） */
export function FieldLockGlyph({ size = 14 }: GlyphProps) {
  const stroke = 1.5;
  return (
    <svg {...svgProps(size)}>
      <rect x="6" y="11" width="12" height="10" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function fieldTypeGlyph(type: BaseField['type'], size = 16) {
  if (type === 'single_select') return <FieldTypeGlyphSingleSelect size={size} />;
  if (type === 'multi_select') return <FieldTypeGlyphMultiSelect size={size} />;
  if (type === 'checkbox') return <FieldTypeGlyphCheckbox size={size} />;
  if (type === 'date') return <FieldTypeGlyphDate size={size} />;
  if (type === 'created_time') return <FieldTypeGlyphCreatedTime size={size} />;
  if (type === 'updated_time') return <FieldTypeGlyphUpdatedTime size={size} />;
  if (type === 'attachment') return <FieldTypeGlyphAttachment size={size} />;
  if (type === 'number') return <FieldTypeGlyphNumber size={size} />;
  if (type === 'formula') return <FieldTypeGlyphFormula size={size} />;
  if (type === 'lookup') return <FieldTypeGlyphLookup size={size} />;
  if (type === 'relation') return <FieldTypeGlyphRelation size={size} />;
  if (type === 'user') return <FieldTypeGlyphUser size={size} />;
  if (type === 'created_by') return <FieldTypeGlyphCreatedBy size={size} />;
  if (type === 'updated_by') return <FieldTypeGlyphUpdatedBy size={size} />;
  if (type === 'url') return <FieldTypeGlyphUrl size={size} />;
  if (type === 'email') return <FieldTypeGlyphEmail size={size} />;
  if (type === 'phone') return <FieldTypeGlyphPhone size={size} />;
  return <FieldTypeGlyphText size={size} />;
}
