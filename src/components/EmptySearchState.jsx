import React from 'react';

export default function EmptySearchState({ isNoResults, query, mode }) {
  if (isNoResults) {
    return (
      <div className="search-empty-state">
        <p className="empty-title">No results found</p>
        <p className="empty-subtitle">Try a different search.</p>
      </div>
    );
  }

  const modePrompts = {
    profile: 'Search for profiles by name, username, skill, or role.',
    domain: 'Search domains by name or topic.',
    job: 'Search job opportunities by title, role, skill, or keywords.'
  };

  return (
    <div className="search-empty-state">
      <div className="empty-icon-circle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <p className="empty-title">Search for people, domains, or roles</p>
      <p className="empty-subtitle">{modePrompts[mode] || 'Type a keyword above to find matches.'}</p>
    </div>
  );
}
