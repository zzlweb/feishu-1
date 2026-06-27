import { Node, mergeAttributes } from '@tiptap/core';

import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

import { buildDonutPaths, useLinkedDashboardSlices } from '../../Bitable/dashboard/useLinkedDashboardSlices';

import './DashboardChartBlock.less';



function DashboardChartView({ node, selected, editor }: NodeViewProps) {

  const title = String(node.attrs.title || '仪表盘图表');

  const chartType = String(node.attrs.chartType || 'donut');

  const sourceTableId = String(node.attrs.sourceTableId || '');

  const { slices, isLinked, refresh } = useLinkedDashboardSlices({

    editor,

    configRaw: String(node.attrs.config || ''),

    sourceTableId,

  });

  const size = 148;

  const strokeWidth = 24;

  const paths = buildDonutPaths(slices, size, strokeWidth);

  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);



  return (

    <NodeViewWrapper

      className={`feishu-dashboard-chart-block${selected ? ' is-selected' : ''}${isLinked ? ' is-linked' : ''}`}

      data-local-block="dashboard"

      data-chart-type={chartType}

      data-source-table-id={sourceTableId || undefined}

      contentEditable={false}

    >

      <div className="feishu-dashboard-chart-block__card">

        <div className="feishu-dashboard-chart-block__body">

          <div className="feishu-dashboard-chart-block__chart-wrap">

            <svg

              className="feishu-dashboard-chart-block__svg"

              viewBox={`0 0 ${size} ${size}`}

              width={size}

              height={size}

              aria-hidden

            >

              <circle

                cx={size / 2}

                cy={size / 2}

                r={(size - strokeWidth) / 2}

                fill="none"

                stroke="#eff0f1"

                strokeWidth={strokeWidth}

              />

              {paths.map((item, index) => (

                <path

                  key={`${item.slice.label}-${index}`}

                  d={item.d}

                  fill="none"

                  stroke={item.slice.color}

                  strokeWidth={strokeWidth}

                  strokeLinecap="butt"

                />

              ))}

            </svg>

            {paths.length === 1 ? (

              <div className="feishu-dashboard-chart-block__center">

                <strong>{paths[0].percent}%</strong>

              </div>

            ) : null}

          </div>

          <div className="feishu-dashboard-chart-block__legend">

            {paths.map((item, index) => (

              <div key={`${item.slice.label}-legend-${index}`} className="feishu-dashboard-chart-block__legend-item">

                <span className="feishu-dashboard-chart-block__legend-dot" style={{ backgroundColor: item.slice.color }} />

                <span className="feishu-dashboard-chart-block__legend-value">{item.percent}%</span>

              </div>

            ))}

          </div>

        </div>

        {isLinked ? (

          <button

            type="button"

            className="feishu-dashboard-chart-block__refresh"

            title="刷新图表数据"

            aria-label={`刷新${title}`}

            onClick={refresh}

          >

            刷新

          </button>

        ) : null}

        {total > 0 ? (

          <span className="feishu-dashboard-chart-block__sr-only">{title}，合计 {total.toLocaleString('zh-CN')}</span>

        ) : null}

      </div>

    </NodeViewWrapper>

  );

}



export const DashboardChartBlock = Node.create({

  name: 'localDashboardChartBlock',

  group: 'block',

  atom: true,



  addAttributes() {

    return {

      title: {

        default: '仪表盘图表',

        parseHTML: element => element.getAttribute('data-title') || '仪表盘图表',

        renderHTML: attributes => ({ 'data-title': attributes.title }),

      },

      chartType: {

        default: 'donut',

        parseHTML: element => element.getAttribute('data-chart-type') || 'donut',

        renderHTML: attributes => ({ 'data-chart-type': attributes.chartType }),

      },

      sourceTableId: {

        default: '',

        parseHTML: element => element.getAttribute('data-source-table-id') || '',

        renderHTML: attributes => (

          attributes.sourceTableId ? { 'data-source-table-id': attributes.sourceTableId } : {}

        ),

      },

      config: {

        default: '',

        parseHTML: element => element.getAttribute('data-config') || '',

        renderHTML: attributes => ({ 'data-config': attributes.config || '' }),

      },

    };

  },



  parseHTML() {

    return [{ tag: 'div[data-local-block="dashboard"]' }];

  },



  renderHTML({ HTMLAttributes }) {

    return [

      'div',

      mergeAttributes(HTMLAttributes, {

        'data-local-block': 'dashboard',

        class: 'feishu-dashboard-chart-block',

      }),

      ['div', { class: 'feishu-dashboard-chart-block__placeholder' }, HTMLAttributes.title || '仪表盘图表'],

    ];

  },



  addNodeView() {

    return ReactNodeViewRenderer(DashboardChartView);

  },

});



export type { DashboardChartSlice, DashboardLinkConfig, DashboardChartConfig } from '../../Bitable/dashboard/chartFromTable';

