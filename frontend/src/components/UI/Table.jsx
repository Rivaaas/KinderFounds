export default function Table({ columns, data, emptyMessage = 'Sin registros' }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-kinder-border shadow-card dark:shadow-card-dark">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-kinder-border bg-gray-50 dark:bg-slate-800/80">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-kinder-card divide-y divide-gray-50 dark:divide-kinder-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row._id || i}
                className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
