import React from 'react';

export function Table({ children, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse text-[13px]">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, onClick, className = '' }) {
  return (
    <tr
      className={`border-b border-[var(--line-lt)] ${onClick ? 'cursor-pointer hover:bg-[var(--line-lt)]' : 'hover:bg-[#fafbfc]'} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, align = 'left', className = '' }) {
  const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }[align] || 'text-left';
  return (
    <th className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--mute)] bg-white border-b border-[var(--line)] whitespace-nowrap ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, align = 'left', className = '', colSpan }) {
  const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }[align] || 'text-left';
  return (
    <td className={`px-4 py-3 text-[13px] text-[var(--text)] ${alignClass} ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan = 6, message = 'No records found.' }) {
  return (
    <TableRow className="hover:bg-white">
      <TableCell colSpan={colSpan} align="center">
        <div className="py-10 text-[#767c83] text-[13px]">{message}</div>
      </TableCell>
    </TableRow>
  );
}

export function TableLoading({ colSpan = 6 }) {
  return (
    <TableRow className="hover:bg-white">
      <TableCell colSpan={colSpan} align="center">
        <div className="py-10 flex items-center justify-center gap-2 text-[#767c83]">
          <div className="w-4 h-4 border-2 border-[#c4c9cf] border-t-[#525a63] rounded-full animate-spin" />
          Loading…
        </div>
      </TableCell>
    </TableRow>
  );
}
