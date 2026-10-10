'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface NavSubmenuItem {
  tab: string;
  label: string;
  badge?: number;
}

interface NavSubmenuProps {
  basePath: string;
  iconSrc: string;
  label: string;
  /** Badge or extra content shown beside the label when expanded. */
  labelExtra?: ReactNode;
  flyoutTitle: string;
  items: NavSubmenuItem[];
  activeTab: string;
  pathname: string;
  collapsed: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

/**
 * Sidebar section with sub-links. Renders as an inline accordion when the
 * sidebar is expanded, and as a hover flyout when it is collapsed.
 */
export default function NavSubmenu({
  basePath, iconSrc, label, labelExtra, flyoutTitle, items,
  activeTab, pathname, collapsed, expanded, onExpandedChange,
}: NavSubmenuProps) {
  const inSection = pathname.startsWith(basePath);

  const renderLinks = (closeOnClick: boolean) =>
    items.map((item) => (
      <Link
        key={item.tab}
        href={`${basePath}?tab=${item.tab}`}
        onClick={closeOnClick ? () => onExpandedChange(false) : undefined}
        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-bold font-serif transition-all ${inSection && activeTab === item.tab
          ? 'text-primary bg-primary/5'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/35'
          }`}
      >
        <span className="flex items-center gap-1.5">
          {item.label}
          {!!item.badge && (
            <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold bg-primary/90 text-white">{item.badge}</span>
          )}
        </span>
      </Link>
    ));

  return (
    <div
      className="space-y-0.5 relative"
      onMouseEnter={() => collapsed && onExpandedChange(true)}
      onMouseLeave={() => collapsed && onExpandedChange(false)}
    >
      <button
        onClick={() => onExpandedChange(!expanded)}
        className={`flex items-center rounded-xl text-xs font-semibold font-serif transition-all duration-150 border cursor-pointer ${collapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'justify-between w-full px-3 py-2'
          } ${inSection && !expanded
            ? 'bg-primary/5 text-primary border-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/45 border-transparent'
          }`}
      >
        <div className="flex items-center gap-3">
          <Image src={iconSrc} alt={`${label} Icon`} width={30} height={30} className="w-5 h-5 shrink-0" unoptimized />
          {!collapsed && (
            <span className="flex items-center gap-2">
              {label}
              {labelExtra}
            </span>
          )}
        </div>
        {!collapsed && (
          expanded ? <ChevronUp className="w-3.5 h-3.5 font-bold" /> : <ChevronDown className="w-3.5 h-3.5 font-bold" />
        )}
      </button>

      {/* Inline accordion (expanded sidebar) */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${expanded && !collapsed
          ? 'grid-rows-[1fr] opacity-100 mt-1'
          : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}
      >
        <div className="overflow-hidden pl-4 space-y-0.5 border-l border-border/40 ml-5">
          {renderLinks(false)}
        </div>
      </div>

      {/* Hover flyout (collapsed sidebar) */}
      {collapsed && (
        <div
          className={`absolute left-[54px] top-0 z-50 bg-card border border-border rounded-2xl p-2.5 shadow-xl w-[150px] space-y-0.5 transition-all duration-300 ease-out transform origin-left before:content-[''] before:absolute before:right-full before:top-0 before:bottom-0 before:w-[25px] before:bg-transparent ${expanded
            ? 'translate-x-2 opacity-100 scale-100 pointer-events-auto'
            : 'translate-x-0 opacity-0 scale-95 pointer-events-none'
            }`}
        >
          <div className="text-[10px] font-bold font-serif text-primary/80 px-2 pb-1 border-b border-border/40 mb-1">{flyoutTitle}</div>
          {renderLinks(true)}
        </div>
      )}
    </div>
  );
}
