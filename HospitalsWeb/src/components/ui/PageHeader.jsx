import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';

export function PageHeader({ breadcrumbs, searchPlaceholder, searchValue, onSearchChange, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.label}>
              {crumb.path && !isLast ? (
                <Link to={crumb.path} className="breadcrumb-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? 'breadcrumb-current' : 'breadcrumb-link'}>
                  {crumb.label}
                </span>
              )}
              {!isLast && <ChevronRight size={14} className="breadcrumb-separator" />}
            </React.Fragment>
          );
        })}
      </div>
      
      <div className="page-header-right">
        {onSearchChange && (
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              className="field"
              placeholder={searchPlaceholder || "Search..."}
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
