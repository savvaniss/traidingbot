import React from "react";

type Props = {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
};

export default function Section({ title, icon, children, className = "", headerRight }: Props) {
  return (
    <div className={`bg-white/80 dark:bg-neutral-900/70 backdrop-blur border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{title}</h3>
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
