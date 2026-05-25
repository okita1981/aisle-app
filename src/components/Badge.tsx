interface BadgeProps {
  label?: string;
  color?: 'indigo' | 'green' | 'red' | 'yellow' | 'slate' | 'orange' | 'blue' | 'purple';
  children?: React.ReactNode;
}

const colorMap = {
  indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  green: 'bg-green-100 text-green-700 border border-green-200',
  red: 'bg-red-100 text-red-700 border border-red-200',
  yellow: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  slate: 'bg-slate-100 text-slate-600 border border-slate-200',
  orange: 'bg-orange-100 text-orange-700 border border-orange-200',
  blue: 'bg-blue-100 text-blue-700 border border-blue-200',
  purple: 'bg-purple-100 text-purple-700 border border-purple-200',
};

export function Badge({ label, color = 'slate', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorMap[color]}`}>
      {children ?? label}
    </span>
  );
}
