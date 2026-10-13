import React from 'react';

export default function SearchModeSelector({ activeMode, onSelectMode }) {
  const modes = [
    { id: 'profile', label: 'Profile' },
    { id: 'domain', label: 'Domain' },
    { id: 'job', label: 'Job / Role' }
  ];

  return (
    <div className="search-mode-selector">
      {modes.map((mode) => {
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            className={`search-mode-tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelectMode(mode.id)}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
