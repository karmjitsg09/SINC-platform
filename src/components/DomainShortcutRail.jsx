import React from 'react';
import { domains as defaultDomains, FEED_CATEGORIES as defaultFeedCategories } from '../data/mockData';

// ─── Icon renderer (covers all domain iconTypes + 'all') ──────────────────────
function RailIcon({ iconType, size = 20 }) {
  switch (iconType) {
    case 'all':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
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
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
          <path d="M12 22A10 10 0 0 0 22 12H12z" />
          <path d="M12 12L2.1 10.55A10 10 0 0 1 12 2v10z" />
        </svg>
      );
    case 'social':
    case 'social_media':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case 'design':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a7 7 0 1 0 7 7" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case 'business':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'ai':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case 'ml':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="12" r="3" />
          <line x1="8.5" y1="7.5" x2="15.5" y2="10.5" />
          <line x1="8.5" y1="16.5" x2="15.5" y2="13.5" />
        </svg>
      );
    case 'cybersecurity':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'finance':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'food':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case 'education':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'research':
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      );
    default:
      return (
        <svg width={size - 1} height={size - 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DomainShortcutRail({
  // Shared
  railMode = 'domain', // 'feed' | 'domain'

  // Feed mode props (Home screen — category filter only)
  feedCategories = defaultFeedCategories,
  selectedFeedCategory = 'all',
  onSelectFeedCategory,

  // Domain mode props (Domains/other screens — unchanged)
  domains = defaultDomains,
  activeDomainId = 'tech',
  onSelectDomain,

  // Messages mode props (unchanged)
  isMessagesMode = false,
  conversations = [],
  selectedConversationId = null,
  onSelectChatMember
}) {
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // ── Messages mode (unchanged) ─────────────────────────────────────────────
  if (isMessagesMode) {
    return (
      <aside className="left-rail">
        <div className="rail-item-wrapper">
          <button
            type="button"
            className={`rail-circle ${!selectedConversationId ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectChatMember && onSelectChatMember(null);
            }}
            aria-label="All Messages"
          >
            <RailIcon iconType="tech" />
          </button>
          <div className="rail-tooltip" role="tooltip">All Messages</div>
        </div>

        {(conversations || []).map((conv) => {
          const isSelected = selectedConversationId === conv.id;
          const isUnread = conv.isUnread || conv.unreadCount > 0;
          const initials = getInitials(conv.name);

          return (
            <div key={conv.id} className="rail-item-wrapper" style={{ position: 'relative' }}>
              <button
                type="button"
                className={`rail-circle ${isSelected ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChatMember && onSelectChatMember(conv);
                }}
                aria-label={`Open chat with ${conv.name}`}
                style={{ position: 'relative', overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {conv.avatarUrl ? (
                  <img src={conv.avatarUrl} alt={conv.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{initials}</span>
                )}
              </button>

              {isUnread && (
                <span
                  style={{
                    position: 'absolute', top: '0px', right: '0px',
                    width: '9px', height: '9px', borderRadius: '50%',
                    backgroundColor: '#3b82f6', boxShadow: '0 0 0 2px #ffffff',
                    zIndex: 2, pointerEvents: 'none'
                  }}
                />
              )}

              <div className="rail-tooltip" role="tooltip">{conv.name}</div>
            </div>
          );
        })}
      </aside>
    );
  }

  // ── Feed mode (Home screen — category filter, NO domain navigation) ───────
  if (railMode === 'feed') {
    return (
      <aside className="left-rail">
        {feedCategories.map((cat) => {
          const isActive = selectedFeedCategory === cat.id;
          return (
            <div key={cat.id} className="rail-item-wrapper">
              <button
                type="button"
                className={`rail-circle ${isActive ? 'active' : ''}`}
                onClick={() => onSelectFeedCategory && onSelectFeedCategory(cat.id)}
                aria-label={`Filter feed: ${cat.name}`}
              >
                <RailIcon iconType={cat.iconType} />
              </button>
              <div className="rail-tooltip" role="tooltip">{cat.name}</div>
            </div>
          );
        })}
      </aside>
    );
  }

  // ── Domain mode (Domains/other screens — existing behaviour unchanged) ────
  return (
    <aside className="left-rail">
      {domains.map((domain) => {
        const isActive = activeDomainId === domain.id;
        return (
          <div key={domain.id} className="rail-item-wrapper">
            <button
              className={`rail-circle ${isActive ? 'active' : ''}`}
              onClick={() => onSelectDomain && onSelectDomain(domain.id)}
              aria-label={`Switch domain to ${domain.name}`}
            >
              <RailIcon iconType={domain.iconType} />
            </button>
            <div className="rail-tooltip" role="tooltip">{domain.name}</div>
          </div>
        );
      })}
    </aside>
  );
}
