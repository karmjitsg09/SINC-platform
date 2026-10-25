import React from 'react';
import { domains as defaultDomains, FEED_CATEGORIES as defaultFeedCategories } from '../data/mockData';

export interface FeedCategoryItem {
  id: string;
  name: string;
  iconType: string;
  [key: string]: any;
}

export interface DomainShortcutRailProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  selectedFeedCategory?: string;
  onSelectFeedCategory?: (category: string) => void;
  activeDomainId?: string;
  onSelectDomain?: (domainId: string) => void;
  feedCategories?: FeedCategoryItem[];
  domains?: any[];
}

// ─── Icon renderer (covers all 13 categories & domains) ──────────────────────
function RailIcon({ iconType, size = 19 }: { iconType: string; size?: number }) {
  switch (iconType) {
    case 'all':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'tech':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'marketing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
          <path d="M12 22A10 10 0 0 0 22 12H12z" />
          <path d="M12 12L2.1 10.55A10 10 0 0 1 12 2v10z" />
        </svg>
      );
    case 'social':
    case 'social_media':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case 'business':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'design':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a7 7 0 1 0 7 7" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case 'ai':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case 'ml':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="12" r="3" />
          <line x1="8.5" y1="7.5" x2="15.5" y2="10.5" />
          <line x1="8.5" y1="16.5" x2="15.5" y2="13.5" />
        </svg>
      );
    case 'cybersecurity':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'finance':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'food':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case 'education':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'research':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

// ─── Main Floating Icon Sidebar Component ─────────────────────────────────────
export default function DomainShortcutRail({
  activeTab = 'home',
  onSelectTab,
  selectedFeedCategory = 'all',
  onSelectFeedCategory,
  activeDomainId = 'tech',
  onSelectDomain,
  feedCategories = defaultFeedCategories,
  domains = defaultDomains
}: DomainShortcutRailProps) {
  const items = feedCategories && feedCategories.length > 0 ? feedCategories : defaultFeedCategories;

  const handleItemClick = (cat: FeedCategoryItem) => {
    const catId = cat.id;

    // 1. Grid/All icon always routes to Home feed with category 'all'
    if (catId === 'all') {
      if (onSelectFeedCategory) {
        onSelectFeedCategory('all');
      }
      if (onSelectTab && activeTab !== 'home') {
        onSelectTab('home');
      }
      return;
    }

    // 2. When currently on Domains tab, switch domain
    if (activeTab === 'domains') {
      if (onSelectDomain) {
        onSelectDomain(catId);
      }
      return;
    }

    // 3. From other tabs or Home, navigate to Home and filter feed to this category
    if (onSelectFeedCategory) {
      onSelectFeedCategory(catId);
    }
    if (onSelectTab && activeTab !== 'home') {
      onSelectTab('home');
    }
  };

  const getIsActive = (catId: string) => {
    if (activeTab === 'home') {
      return (selectedFeedCategory || 'all').toLowerCase() === catId.toLowerCase();
    }
    if (activeTab === 'domains') {
      return (activeDomainId || 'tech').toLowerCase() === catId.toLowerCase();
    }
    if (activeTab === 'search') {
      return catId === 'research';
    }
    if (activeTab === 'messages') {
      return catId === 'social_media';
    }
    return false;
  };

  return (
    <aside className="left-rail" aria-label="SINC Category and Domain Navigation">
      {items.map((cat: FeedCategoryItem) => {
        const isActive = getIsActive(cat.id);
        const ariaLabel = `${cat.name} — ${cat.id === 'all' ? 'All Community Feed' : 'Domain & Category'}`;

        return (
          <div key={cat.id} className="rail-item-wrapper">
            <button
              type="button"
              className={`rail-circle ${isActive ? 'active' : ''}`}
              onClick={() => handleItemClick(cat)}
              aria-label={ariaLabel}
              aria-pressed={isActive}
              title={cat.name}
            >
              <RailIcon iconType={cat.iconType} size={19} />
            </button>
            <div className="rail-tooltip" role="tooltip">{cat.name}</div>
          </div>
        );
      })}
    </aside>
  );
}
