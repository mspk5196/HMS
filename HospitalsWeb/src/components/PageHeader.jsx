import React from 'react';

// Tasteful contextual icons for primary hospital management modules
const CATEGORY_ICONS = {
  'Staff & Salary': (
    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  'Patient & Hospital': (
    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  'Pharmacy': (
    <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  'Admin': (
    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

/**
 * Modern Standard Page Header for Neha Hospital Management System.
 *
 * @param {Object} props
 * @param {string} [props.category] Section / Category title (e.g. "Staff & Salary")
 * @param {string} [props.parent] Optional intermediate breadcrumb (e.g. "Department & Role")
 * @param {React.ReactNode} props.title Current active page title (e.g. "Payroll")
 * @param {React.ReactNode} [props.subtitle] Helper or description text
 * @param {React.ReactNode} [props.icon] Custom icon override for the category
 * @param {React.ReactNode} [props.badge] Status or count pill (e.g. "84 employees")
 * @param {React.ReactNode} [props.actions] Right-side action buttons
 * @param {React.ReactNode} [props.children] Alternative slot for actions
 * @param {Function} [props.onBack] Callback for back button navigation
 * @param {string} [props.backLabel] Optional text next to back button
 * @param {string} [props.className] Optional wrapper classes
 */
export default function PageHeader({
  category,
  parent,
  title,
  subtitle,
  icon,
  badge,
  actions,
  children,
  onBack,
  backLabel,
  className = '',
}) {
  const categoryIcon = icon || (category ? CATEGORY_ICONS[category] : null);
  const actionContent = actions || children;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2 flex-wrap">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mr-1 p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200/70 border border-gray-200/80 transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-semibold"
              title="Go back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel && <span>{backLabel}</span>}
            </button>
          )}

          {category && (
            <span className="inline-flex items-center gap-1.5 text-gray-800">
              {categoryIcon && (
                <span className="p-1 rounded-md bg-white border border-gray-200/80 shadow-2xs inline-flex items-center justify-center">
                  {categoryIcon}
                </span>
              )}
              <span>{category}</span>
            </span>
          )}

          {category && (
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}

          {parent && (
            <>
              <span className="text-gray-700 font-semibold">{parent}</span>
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}

          <span className="text-blue-600 font-extrabold">{title}</span>

          {badge && (
            <span className="ml-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
              {badge}
            </span>
          )}
        </h1>

        {subtitle && (
          <p className="text-xs sm:text-[13px] text-gray-500 mt-1 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actionContent && (
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {actionContent}
        </div>
      )}
    </div>
  );
}
