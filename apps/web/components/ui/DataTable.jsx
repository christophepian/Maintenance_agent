import { cn } from "../../lib/utils";

/**
 * DataTable — replaces raw <table> with inline-table class.
 * Wraps children in proper structure with overflow handling.
 *
 * Usage:
 *   <DataTable
 *     columns={["Name", "Address", "Actions"]}
 *     rows={items}
 *     renderRow={(item) => (
 *       <tr key={item.id}>
 *         <td className="cell-bold">{item.name}</td>
 *         <td>{item.address}</td>
 *       </tr>
 *     )}
 *   />
 *
 * Or use children directly:
 *   <DataTable columns={["Name", "Address"]}>
 *     <tbody>...</tbody>
 *   </DataTable>
 */
export default function DataTable({
  columns,
  rows,
  renderRow,
  children,
  className,
  empty = "No data found.",
}) {
  const hasData = rows ? rows.length > 0 : true;

  if (!hasData) {
    return <p className="text-sm text-muted m-0">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("inline-table", className)}>
        {columns && (
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
        )}
        {children || (
          <tbody>
            {rows.map((row, idx) => renderRow(row, idx))}
          </tbody>
        )}
      </table>
    </div>
  );
}
