import React from 'react';

export default function DomainSearchResults({ domains = [], onSelectDomain }) {
  const renderIcon = (iconType) => {
    switch (iconType) {
      case 'tech':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9"></circle>
            <circle cx="12" cy="12" r="4"></circle>
          </svg>
        );
      case 'marketing':
        return <span style={{ fontSize: '15px', fontWeight: '600' }}>?</span>;
      case 'social':
      case 'social_media':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="3 3">
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
        );
      case 'design':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 3a6 6 0 0 0 0 12 6 6 0 0 0 0-12z"></path>
          </svg>
        );
      case 'food':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
        );
    }
  };

  return (
    <div className="search-results-list">
      {domains.map((domain) => (
        <div
          key={domain.id}
          className="search-card-item domain-result-item"
          onClick={() => onSelectDomain && onSelectDomain(domain)}
        >
          <div className="domain-item-left">
            <div className="domain-item-icon">
              {renderIcon(domain.iconType)}
            </div>
            <div className="domain-item-text">
              <span className="domain-item-name">
                {domain.name.toUpperCase()}
              </span>
              {domain.feed?.descriptionTop && (
                <span className="domain-item-desc">
                  {domain.feed.descriptionTop}
                </span>
              )}
            </div>
          </div>
          <div className="result-chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
