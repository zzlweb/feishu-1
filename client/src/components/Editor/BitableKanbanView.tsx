import { valueText, type BaseField, type BaseRecord, type BaseTable, type CellValue, type GalleryViewConfig } from './bitableModel';
import { FieldDisplay } from './BitableViewShared';

export interface BitableKanbanViewProps {
  table: BaseTable;
  config: GalleryViewConfig;
  records: BaseRecord[];
  addRecordToColumn: (statusValue: string) => void;
}

function getStatusField(table: BaseTable): BaseField | null {
  return table.fields.find(field => field.type === 'single_select') ?? null;
}

export function BitableKanbanView({
  table,
  config,
  records,
  addRecordToColumn,
}: BitableKanbanViewProps) {
  const statusField = getStatusField(table);
  if (!statusField) {
    return <div className="base-kanban-empty">请先创建单选字段以使用看板视图</div>;
  }

  const choices = statusField.options?.choices ?? [];
  if (choices.length === 0) {
    return <div className="base-kanban-empty">请先为单选字段添加选项</div>;
  }

  const countByStatus = (statusName: string) =>
    records.filter(record => valueText(record.fields[statusField.id]) === statusName).length;

  return (
    <div className="base-kanban">
      <div className="base-kanban__board">
        {choices.map(choice => {
          const columnRecords = records.filter(record => valueText(record.fields[statusField.id]) === choice.name);

          return (
            <div
              key={choice.id}
              className="base-kanban__column"
              style={{ backgroundColor: choice.color }}
            >
              <header className="base-kanban__column-header">
                <span className="base-kanban__column-title">{choice.name}</span>
                <div className="base-kanban__column-actions">
                  <button
                    type="button"
                    className="base-kanban__column-action"
                    aria-label={`在${choice.name}下新建记录`}
                    onClick={() => addRecordToColumn(choice.name)}
                  >
                    +
                  </button>
                  <button type="button" className="base-kanban__column-action" aria-label="更多">⋯</button>
                </div>
              </header>
              <div className="base-kanban__column-count">{countByStatus(choice.name)}</div>
              <div className="base-kanban__column-cards">
                {columnRecords.map(record => {
                  const title = valueText(record.fields[config.titleFieldId || table.primaryFieldId]) || '未命名记录';
                  return (
                    <div className="base-kanban__card" key={record.id}>
                      <strong className="base-kanban__card-title">{title}</strong>
                      {config.visibleFieldIds.map(fieldId => {
                        const field = table.fields.find(item => item.id === fieldId);
                        if (!field || field.id === statusField.id) return null;
                        const value = record.fields[fieldId];
                        if (!valueText(value)) return null;
                        return (
                          <div className="base-kanban__card-field" key={field.id}>
                            <label>{field.name}</label>
                            <FieldDisplay field={field} value={value as CellValue} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="base-kanban__column-add"
                aria-label={`在${choice.name}下添加记录`}
                onClick={() => addRecordToColumn(choice.name)}
              >
                +
              </button>
            </div>
          );
        })}
        <button type="button" className="base-kanban__create-group">+ 新建分组</button>
      </div>
    </div>
  );
}
