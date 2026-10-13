import React from 'react';
import { domains as defaultDomains } from '../data/mockData';

export default function DomainList({ domains = defaultDomains, onSelectDomain }) {
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
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="8"></circle>
          </svg>
        );
    }
  };

  return (
    <div className="main-content">
      <div className="content-card">
        <h2 className="page-title">Domains</h2>
        <div className="list-container">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="domain-card-item"
              onClick={() => onSelectDomain(domain)}
            >
              <div className="domain-item-left">
                <div className="domain-item-icon">
                  {renderIcon(domain.iconType)}
                </div>
                <span className="domain-item-name">
                  {domain.name.toUpperCase()}
                </span>
              </div>
              <div className="chevron-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
