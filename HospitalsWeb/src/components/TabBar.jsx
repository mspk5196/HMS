import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';

/**
 * Universal, responsive TabBar component:
 * - Fills tabs across the row until the end of the page/container.
 * - Dynamically measures container width and each tab width via ResizeObserver.
 * - Only collapses tabs that actually exceed available space into a sleek "More Options ▾" dropdown menu.
 * - When an overflow tab is active, the dropdown button dynamically highlights and shows its name: [ Biometric Devices ▾ ].
 * - Supports counts/badges, icons, dark mode, keyboard navigation, and click-outside dismissal.
 */
export default function TabBar({
  tabs = [],
  active,
  onChange,
  activeColor = 'emerald', // 'emerald' | 'blue'
  dropdownLabel = 'More',
  className = '',
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [measuredTabWidths, setMeasuredTabWidths] = useState([]);
  const [measuredMoreWidth, setMeasuredMoreWidth] = useState(130);

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const measureContainerRef = useRef(null);

  // Filter visible tabs (those with show !== false)
  const visibleTabs = useMemo(() => tabs.filter((t) => t.show !== false), [tabs]);

  // Initial and dynamic resize measurement of container
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 0);
      }
    };
    updateWidth();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Measure each tab's natural width from the hidden measurement container
  useLayoutEffect(() => {
    if (!measureContainerRef.current) return;
    const children = Array.from(measureContainerRef.current.children);
    if (!children.length) return;

    // Last child is the More button preview
    const tabEls = children.slice(0, children.length - 1);
    const moreEl = children[children.length - 1];

    const widths = tabEls.map((el) => Math.ceil(el.getBoundingClientRect().width));
    const moreW = moreEl ? Math.ceil(moreEl.getBoundingClientRect().width) : 130;

    setMeasuredTabWidths(widths);
    setMeasuredMoreWidth(moreW);
  }, [visibleTabs, dropdownLabel]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const activeKey = active;
  const getTabKey = (t) => t.value ?? t.id;

  // Calculate how many tabs fit before overflowing
  const visibleCount = useMemo(() => {
    if (!visibleTabs.length) return 0;
    // Before measurement finishes, show all tabs across row rather than hardcoding 4
    if (!containerWidth || measuredTabWidths.length !== visibleTabs.length) {
      return visibleTabs.length;
    }

    const GAP = 8; // gap-2 = 8px
    const available = containerWidth;

    // Check if ALL tabs fit across the row without the "More" button
    let totalAllWidth = 0;
    for (let i = 0; i < measuredTabWidths.length; i++) {
      totalAllWidth += measuredTabWidths[i] + (i > 0 ? GAP : 0);
    }
    if (totalAllWidth <= available) {
      return visibleTabs.length; // No overflow needed!
    }

    // Otherwise calculate how many fit leaving room for More button
    const neededForMore = measuredMoreWidth + GAP;
    let used = 0;
    let count = 0;

    for (let i = 0; i < measuredTabWidths.length; i++) {
      const tabW = measuredTabWidths[i];
      const nextUsed = used + (count > 0 ? GAP : 0) + tabW;
      if (nextUsed + GAP + neededForMore <= available) {
        used = nextUsed;
        count++;
      } else {
        break;
      }
    }

    return Math.max(1, count);
  }, [visibleTabs, containerWidth, measuredTabWidths, measuredMoreWidth]);

  if (!visibleTabs.length) return null;

  const hasOverflow = visibleTabs.length > visibleCount;
  const primaryTabs = hasOverflow ? visibleTabs.slice(0, visibleCount) : visibleTabs;
  const overflowTabs = hasOverflow ? visibleTabs.slice(visibleCount) : [];

  // Check if current active tab is inside overflow dropdown
  const activeOverflowTab = overflowTabs.find((t) => getTabKey(t) === activeKey);
  const isOverflowActive = Boolean(activeOverflowTab);

  const isEmerald = activeColor === 'emerald';
  const activeTabClasses = isEmerald
    ? 'bg-[#047857] text-white shadow-xs'
    : 'bg-[#1e40af] text-white shadow-xs';

  const activeBadgeClasses = 'bg-white/25 text-white';
  const inactiveBadgeClasses = 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300';

  return (
    <div
      ref={containerRef}
      className={`relative w-full flex items-center justify-between gap-2 py-1 ${className}`}
    >
      {/* ── Invisible off-screen element to accurately measure each tab's pixel width ── */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        className="absolute top-0 left-0 -z-50 invisible pointer-events-none opacity-0 flex items-center gap-2 whitespace-nowrap"
      >
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <div key={getTabKey(t)} className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0">
              {Icon && <span className="w-3.5 h-3.5" />}
              <span>{t.label}</span>
              {t.count > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold">99</span>}
            </div>
          );
        })}
        {/* Sample More Button measurement */}
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 border border-transparent">
          <span>{dropdownLabel}</span>
          <span className="text-[10px] px-1.5 py-0.5 font-bold">9</span>
          <span className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* ── Primary Visible Tabs (filling across the row till the end of the page) ── */}
      <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
        {primaryTabs.map((t) => {
          const key = getTabKey(t);
          const isActive = key === activeKey;
          const Icon = t.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                onChange(key);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                isActive
                  ? activeTabClasses
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800/70'
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500'}`} />}
              <span>{t.label}</span>
              {t.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? activeBadgeClasses : inactiveBadgeClasses
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overflow "More Options ▾" Dropdown ── */}
      {hasOverflow && (
        <div className="relative shrink-0 ml-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
              isOverflowActive
                ? isEmerald
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700 shadow-xs'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 shadow-xs'
                : dropdownOpen
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-gray-400 dark:border-slate-600'
                : 'text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/70 border-dashed border-gray-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60'
            }`}
          >
            <span>
              {isOverflowActive ? `${activeOverflowTab.label}` : dropdownLabel}
            </span>
            {!isOverflowActive && overflowTabs.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-bold">
                {overflowTabs.length}
              </span>
            )}
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>{dropdownLabel}</span>
                <span className="text-[10px] font-medium">{overflowTabs.length} more</span>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {overflowTabs.map((t) => {
                  const key = getTabKey(t);
                  const isActive = key === activeKey;
                  const Icon = t.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onChange(key);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                        isActive
                          ? isEmerald
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {Icon && (
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive
                                ? isEmerald
                                  ? 'text-emerald-700'
                                  : 'text-blue-600'
                                : 'text-gray-400'
                            }`}
                          />
                        )}
                        <span className="truncate">{t.label}</span>
                      </div>
                      {isActive && (
                        <svg
                          className={`w-4 h-4 shrink-0 ml-2 ${
                            isEmerald ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      {t.count > 0 && !isActive && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 ml-2">
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
