
import React from "react";

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="Loading dashboard">
      <div className="skeleton-heading">
        <Skeleton className="sk-eyebrow" />
        <Skeleton className="sk-title" />
        <Skeleton className="sk-subtitle" />
      </div>

      <div className="skeleton-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="skeleton-stat" key={i}>
            <Skeleton className="sk-stat-label" />
            <Skeleton className="sk-stat-value" />
            <Skeleton className="sk-stat-footer" />
          </div>
        ))}
      </div>

      <div className="skeleton-panel">
        <div className="skeleton-panel-heading">
          <div>
            <Skeleton className="sk-panel-title" />
            <Skeleton className="sk-panel-subtitle" />
          </div>
          <Skeleton className="sk-button" />
        </div>

        {Array.from({ length: 5 }, (_, i) => (
          <div className="skeleton-table-row" key={i}>
            <Skeleton className="sk-avatar" />
            <div className="skeleton-row-text">
              <Skeleton className="sk-row-title" />
              <Skeleton className="sk-row-subtitle" />
            </div>
            <Skeleton className="sk-row-status" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="app-shell sidebar-open app-loading-shell">
      <aside className="sidebar skeleton-sidebar">
        <div className="skeleton-brand">
          <Skeleton className="sk-brand-icon" />
          <div>
            <Skeleton className="sk-brand-name" />
            <Skeleton className="sk-brand-subtitle" />
          </div>
        </div>

        <Skeleton className="sk-school-switch" />

        {[1, 2].map((group) => (
          <div className="skeleton-nav-group" key={group}>
            <Skeleton className="sk-nav-heading" />
            {Array.from({ length: group === 1 ? 4 : 3 }, (_, i) => (
              <Skeleton className="sk-nav-item" key={i} />
            ))}
          </div>
        ))}

        <div className="skeleton-sidebar-bottom">
          <Skeleton className="sk-avatar" />
          <div className="skeleton-row-text">
            <Skeleton className="sk-row-title" />
            <Skeleton className="sk-row-subtitle" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar skeleton-topbar">
          <Skeleton className="sk-crumb" />
          <Skeleton className="sk-search" />
          <Skeleton className="sk-top-avatar" />
        </header>

        <div className="content">
          <PageSkeleton />
        </div>
      </main>
    </div>
  );
}

export function FeeSkeleton() {
  return (
    <div className="fee-skeleton" role="status" aria-label="Loading fee account">
      <div className="skeleton-heading">
        <Skeleton className="sk-eyebrow" />
        <Skeleton className="sk-title" />
        <Skeleton className="sk-subtitle" />
      </div>

      <div className="skeleton-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="skeleton-stat" key={i}>
            <Skeleton className="sk-stat-label" />
            <Skeleton className="sk-stat-value" />
            <Skeleton className="sk-stat-footer" />
          </div>
        ))}
      </div>

      {[1, 2].map((section) => (
        <div className="skeleton-panel" key={section}>
          <div className="skeleton-panel-heading">
            <div>
              <Skeleton className="sk-panel-title" />
              <Skeleton className="sk-panel-subtitle" />
            </div>
            {section === 1 && <Skeleton className="sk-button" />}
          </div>

          {Array.from({ length: section === 1 ? 3 : 2 }, (_, i) => (
            <div className="skeleton-table-row" key={i}>
              <div className="skeleton-row-text">
                <Skeleton className="sk-row-title" />
                <Skeleton className="sk-row-subtitle" />
              </div>
              <Skeleton className="sk-row-status" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
