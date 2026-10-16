import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { domains as defaultDomains } from '../data/mockData';
import { setUserDomainMemberships } from '../lib/profileService';
import { checkIsDomainMember } from '../lib/domainUtils';
import {
  Compass,
  Search,
  Users,
  MessageSquare,
  Check,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  Code,
  TrendingUp,
  Share2,
  Palette,
  Utensils,
  Cpu,
  Binary,
  Shield,
  DollarSign,
  Briefcase
} from 'lucide-react';

export default function DomainList({ domains = defaultDomains, onSelectDomain }) {
  const { user, updateProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all'); // 'all' | 'joined' | 'explore'
  const [membershipLoading, setMembershipLoading] = useState({});

  // Active user domain memberships
  const userDomainIds = user?.domains || [];

  const handleToggleJoin = async (e, domainId) => {
    e.stopPropagation();
    if (!user?.id || membershipLoading[domainId]) return;

    setMembershipLoading((prev) => ({ ...prev, [domainId]: true }));
    const targetDomain = domains.find((d) => d.id === domainId);
    const isJoined = checkIsDomainMember(userDomainIds, domainId, targetDomain?.name);
    const updatedIds = isJoined
      ? userDomainIds.filter((id) => !checkIsDomainMember([id], domainId, targetDomain?.name))
      : [...userDomainIds, domainId];

    try {
      await setUserDomainMemberships(user.id, updatedIds);
      if (updateProfile) {
        updateProfile({ domains: updatedIds });
      }
    } catch (err) {
      console.warn('Failed to update domain membership:', err);
    } finally {
      setMembershipLoading((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  const renderDomainIcon = (iconType) => {
    switch (iconType) {
      case 'tech': return <Code size={20} className="domain-icon text-blue" />;
      case 'marketing': return <TrendingUp size={20} className="domain-icon text-purple" />;
      case 'social':
      case 'social_media': return <Share2 size={20} className="domain-icon text-cyan" />;
      case 'design': return <Palette size={20} className="domain-icon text-pink" />;
      case 'food': return <Utensils size={20} className="domain-icon text-amber" />;
      case 'ai': return <Cpu size={20} className="domain-icon text-indigo" />;
      case 'ml': return <Binary size={20} className="domain-icon text-purple" />;
      case 'cybersecurity': return <Shield size={20} className="domain-icon text-red" />;
      case 'finance': return <DollarSign size={20} className="domain-icon text-emerald" />;
      case 'business': return <Briefcase size={20} className="domain-icon text-amber" />;
      default: return <Compass size={20} className="domain-icon text-blue" />;
    }
  };

  const filteredDomains = domains.filter((d) => {
    const isJoined = userDomainIds.includes(d.id);
    if (domainFilter === 'joined' && !isJoined) return false;
    if (domainFilter === 'explore' && isJoined) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = d.name.toLowerCase().includes(q);
    const descMatch = d.feed?.descriptionTop?.toLowerCase().includes(q) || d.feed?.descriptionBottom?.toLowerCase().includes(q);
    return nameMatch || descMatch;
  });

  return (
    <div className="domains-page-layout">
      <div className="domains-page-card">
        {/* Header */}
        <div className="domains-header-section">
          <div className="header-titles">
            <h1 className="domains-title">Domains & Communities</h1>
            <p className="domains-subtitle">
              Join specialized domain hubs to participate in technical discussions, review code, and collaborate.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="domains-controls-bar">
            <div className="domains-search-box">
              <Search size={15} className="domains-search-icon" />
              <input
                type="text"
                placeholder="Search domain hubs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="domains-search-input"
              />
            </div>

            <div className="domains-filter-pills">
              <button
                type="button"
                className={`filter-pill ${domainFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDomainFilter('all')}
              >
                All Hubs ({domains.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${domainFilter === 'joined' ? 'active' : ''}`}
                onClick={() => setDomainFilter('joined')}
              >
                Joined ({userDomainIds.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${domainFilter === 'explore' ? 'active' : ''}`}
                onClick={() => setDomainFilter('explore')}
              >
                Explore New
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Domain Cards Grid */}
        <div className="domains-grid">
          {filteredDomains.map((domain) => {
            const isJoined = checkIsDomainMember(userDomainIds, domain.id, domain.name);
            const isLoading = membershipLoading[domain.id];
            const channelCount = domain.channels?.length || 3;

            return (
              <div
                key={domain.id}
                className="domain-card-v2"
                onClick={() => onSelectDomain(domain)}
                role="button"
                tabIndex={0}
              >
                {/* Domain Card Visual Top Banner */}
                <div className="domain-card-banner">
                  <div className="domain-card-icon-circle">
                    {renderDomainIcon(domain.iconType)}
                  </div>
                  <button
                    type="button"
                    className={`domain-join-btn ${isJoined ? 'joined' : ''}`}
                    onClick={(e) => handleToggleJoin(e, domain.id)}
                    disabled={isLoading}
                    title={isJoined ? 'Leave Domain' : 'Join Domain'}
                  >
                    {isJoined ? (
                      <>
                        <Check size={12} />
                        <span>Joined</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Join</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Domain Card Body */}
                <div className="domain-card-body">
                  <h3 className="domain-name">{domain.name}</h3>
                  <p className="domain-desc">
                    {domain.feed?.descriptionTop || `Discussions, channels, and projects in ${domain.name}.`}
                  </p>

                  <div className="domain-card-meta-row">
                    <span className="meta-channels-badge">
                      <MessageSquare size={12} />
                      <span>{channelCount} channels</span>
                    </span>

                    <span className="meta-explore-arrow">
                      <span>Enter Hub</span>
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
