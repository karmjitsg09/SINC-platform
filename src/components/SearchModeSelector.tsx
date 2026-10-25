import React from 'react';
import { Users, Compass, Briefcase, FileText, Sparkles, LucideIcon } from 'lucide-react';

export type SearchModeType = 'all' | 'profile' | 'post' | 'domain' | 'job' | string;

export interface SearchModeItem {
  id: SearchModeType;
  label: string;
  icon: LucideIcon;
}

export interface SearchModeSelectorProps {
  activeMode: SearchModeType;
  onSelectMode: (mode: SearchModeType) => void;
}

export default function SearchModeSelector({ activeMode, onSelectMode }: SearchModeSelectorProps) {
  const modes: SearchModeItem[] = [
    { id: 'all', label: 'All Results', icon: Sparkles },
    { id: 'profile', label: 'People', icon: Users },
    { id: 'post', label: 'Posts', icon: FileText },
    { id: 'domain', label: 'Domains', icon: Compass },
    { id: 'job', label: 'Jobs & Roles', icon: Briefcase }
  ];

  return (
    <div className="search-mode-selector" role="tablist">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`search-mode-tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelectMode(mode.id)}
          >
            <Icon size={14} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
