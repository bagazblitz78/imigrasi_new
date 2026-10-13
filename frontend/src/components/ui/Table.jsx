import { EmptyState, ErrorState, TableSkeleton } from "./States";

export function DataTable({
  columns,
  rows = [],
  loading,
  error,
  onRetry,
  sort,
  order,
  onSortChange,
  getRowKey = (row) => row.id,
  onRowClick,
  emptyTitle,
  emptyText,
}) {
  if (loading) return <TableSkeleton cols={columns.length} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!rows.length)
    return <EmptyState title={emptyTitle || "Belum ada data"} text={emptyText} />;

  const handleSort = (col) => {
    if (!col.sortable || !onSortChange) return;
    const nextOrder = sort === col.sortKey && order === "desc" ? "asc" : "desc";
    onSortChange(col.sortKey, nextOrder);
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => {
              const sortKey = col.sortKey || col.key;
              const active = sort === sortKey;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={col.sortable ? "sortable" : undefined}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined}
                  onClick={() => handleSort(col)}
                >
                  {col.header}
                  {col.sortable && (
                    <span aria-hidden="true" style={{ marginLeft: 6, opacity: active ? 1 : 0.35 }}>
                      {active ? (order === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
