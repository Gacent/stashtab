interface TagBadgeProps {
  name: string;
  onClick?: () => void;
  active?: boolean;
}

export default function TagBadge({ name, onClick, active }: TagBadgeProps) {
  const colors: Record<string, string> = {
    "技术": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    "AI": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    "商业": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    "产品": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    "设计": "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    "生活": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    "开源": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    "教程": "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    "新闻": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    "观点": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    "工具": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    "资源": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    "阅读": "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  };

  const colorClass = colors[name] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

  return (
    <span
      onClick={onClick}
      className={`inline-block text-xs px-2 py-0.5 rounded-full cursor-pointer ${active ? "ring-2 ring-blue-400" : ""} ${colorClass}`}
    >
      {name}
    </span>
  );
}
