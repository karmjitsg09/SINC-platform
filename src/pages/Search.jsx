import React, { useState, useEffect } from 'react';
import SearchModeSelector from '../components/SearchModeSelector';
import SearchInput from '../components/SearchInput';
import ProfileSearchResults from '../components/ProfileSearchResults';
import DomainSearchResults from '../components/DomainSearchResults';
import JobSearchResults from '../components/JobSearchResults';
import EmptySearchState from '../components/EmptySearchState';

import { domains as allDomains, opportunities as allOpportunities } from '../data/mockData';
import { searchProfiles } from '../lib/socialService';
import { getPostsByDomain } from '../lib/postService';
import { useAuth } from '../context/AuthContext';
import {
  Search as SearchIcon,
  Users,
  Compass,
  FileText,
  Briefcase,
  ExternalLink,
  Heart,
  MessageSquare,
  Clock
} from 'lucide-react';

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function Search({ onSelectDomain, onSelectProfile, onNavigateToPostView }) {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [searchMode, setSearchMode] = useState('all'); // 'all' | 'profile' | 'post' | 'domain' | 'job'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  const [asyncProfiles, setAsyncProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const [allPosts, setAllPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Search profiles
  useEffect(() => {
    let isMounted = true;
    async function fetchProfiles() {
      if (searchMode === 'profile' || searchMode === 'all') {
        setLoadingProfiles(true);
        const results = await searchProfiles(searchQuery, currentUserId);
        if (isMounted) {
          setAsyncProfiles(results);
          setLoadingProfiles(false);
        }
      }
    }
    fetchProfiles();
    return () => { isMounted = false; };
  }, [searchQuery, searchMode, currentUserId]);

  // Load and search posts
  useEffect(() => {
    let isMounted = true;
    async function fetchPosts() {
      if (searchMode === 'post' || searchMode === 'all') {
        setLoadingPosts(true);
        const posts = await getPostsByDomain('all');
        if (isMounted) {
          setAllPosts(posts || []);
          setLoadingPosts(false);
        }
      }
    }
    fetchPosts();
    return () => { isMounted = false; };
  }, [searchMode]);

  const handleModeChange = (mode) => {
    setSearchMode(mode);
    setSelectedJob(null);
  };

  const getPlaceholder = () => {
    switch (searchMode) {
      case 'profile':
        return 'Search people by name, @username, skill, or role...';
      case 'post':
        return 'Search posts by keywords, tags, or domain...';
      case 'domain':
        return 'Search domains & hubs...';
      case 'job':
        return 'Search jobs, internships, or roles...';
      default:
        return 'Search people, posts, domains, and opportunities...';
    }
  };

  const qClean = searchQuery.replace(/^@/, '').toLowerCase().trim();

  // Filter posts
  const filteredPosts = allPosts.filter((p) => {
    if (!qClean) return true;
    const matchTitle = p.title?.toLowerCase().includes(qClean);
    const matchContent = p.content?.toLowerCase().includes(qClean);
    const matchDomain = p.domain?.toLowerCase().includes(qClean);
    const matchAuthor = p.author?.toLowerCase().includes(qClean);
    return matchTitle || matchContent || matchDomain || matchAuthor;
  });

  // Filter domains
  const filteredDomains = allDomains.filter((d) => {
    if (!qClean) return true;
    const matchName = d.name.toLowerCase().includes(qClean);
    const matchDesc = d.feed?.descriptionTop?.toLowerCase().includes(qClean);
    return matchName || matchDesc;
  });

  // Filter jobs
  const filteredOpportunities = allOpportunities.filter((j) => {
    if (!qClean) return true;
    const matchTitle = j.title.toLowerCase().includes(qClean);
    const matchRole = j.role.toLowerCase().includes(qClean);
    const matchPos = j.position.toLowerCase().includes(qClean);
    const matchDomain = j.domainName.toLowerCase().includes(qClean);
    const matchCompany = j.company.toLowerCase().includes(qClean);
    const matchSkill = j.skills?.some((s) => s.toLowerCase().includes(qClean));
    const matchDesc = j.description.toLowerCase().includes(qClean);
    return (
      matchTitle ||
      matchRole ||
      matchPos ||
      matchDomain ||
      matchCompany ||
      matchSkill ||
      matchDesc
    );
  });

  const renderContent = () => {
    if (searchMode === 'job' && selectedJob) {
      return (
        <JobSearchResults
          selectedJob={selectedJob}
          onBackToResults={() => setSelectedJob(null)}
        />
      );
    }

    // ALL RESULTS OVERVIEW TAB
    if (searchMode === 'all') {
      const hasPeople = asyncProfiles.length > 0;
      const hasPosts = filteredPosts.length > 0;
      const hasDomains = filteredDomains.length > 0;
      const hasJobs = filteredOpportunities.length > 0;
      const hasAny = hasPeople || hasPosts || hasDomains || hasJobs;

      if (!hasAny && searchQuery.trim()) {
        return <EmptySearchState isNoResults query={searchQuery} mode={searchMode} />;
      }

      return (
        <div className="search-overview-container">
          {/* Top People Matches */}
          {hasPeople && (
            <section className="search-overview-section">
              <div className="overview-section-header">
                <div className="header-left">
                  <Users size={16} className="text-blue" />
                  <h3>People ({asyncProfiles.length})</h3>
                </div>
                {asyncProfiles.length > 3 && (
                  <button type="button" className="see-all-link" onClick={() => setSearchMode('profile')}>
                    See all people
                  </button>
                )}
              </div>
              <ProfileSearchResults
                users={asyncProfiles.slice(0, 4)}
                onSelectProfile={onSelectProfile}
                currentUserId={currentUserId}
              />
            </section>
          )}

          {/* Top Posts Matches */}
          {hasPosts && (
            <section className="search-overview-section">
              <div className="overview-section-header">
                <div className="header-left">
                  <FileText size={16} className="text-blue" />
                  <h3>Posts ({filteredPosts.length})</h3>
                </div>
                {filteredPosts.length > 3 && (
                  <button type="button" className="see-all-link" onClick={() => setSearchMode('post')}>
                    See all posts
                  </button>
                )}
              </div>
              <div className="search-posts-grid">
                {filteredPosts.slice(0, 4).map((post) => (
                  <div
                    key={post.id}
                    className="search-post-result-card"
                    onClick={() => onNavigateToPostView && onNavigateToPostView(post.id, { activeTab: 'search' })}
                  >
                    <div className="card-top-row">
                      <span className="search-domain-tag">{post.domain || 'Tech'}</span>
                      <span className="post-time">{formatTimeAgo(post.created_at)}</span>
                    </div>
                    <h4>{post.title}</h4>
                    <p className="post-snippet">{post.content?.substring(0, 110)}...</p>
                    <div className="card-footer-row">
                      <span className="post-author-name">By {post.author}</span>
                      <span className="card-explore-btn">View Post →</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top Domains Matches */}
          {hasDomains && (
            <section className="search-overview-section">
              <div className="overview-section-header">
                <div className="header-left">
                  <Compass size={16} className="text-blue" />
                  <h3>Domains & Hubs ({filteredDomains.length})</h3>
                </div>
                {filteredDomains.length > 3 && (
                  <button type="button" className="see-all-link" onClick={() => setSearchMode('domain')}>
                    See all domains
                  </button>
                )}
              </div>
              <DomainSearchResults
                domains={filteredDomains.slice(0, 4)}
                onSelectDomain={onSelectDomain}
              />
            </section>
          )}

          {/* Top Jobs Matches */}
          {hasJobs && (
            <section className="search-overview-section">
              <div className="overview-section-header">
                <div className="header-left">
                  <Briefcase size={16} className="text-blue" />
                  <h3>Opportunities ({filteredOpportunities.length})</h3>
                </div>
                {filteredOpportunities.length > 3 && (
                  <button type="button" className="see-all-link" onClick={() => setSearchMode('job')}>
                    See all jobs
                  </button>
                )}
              </div>
              <JobSearchResults
                opportunities={filteredOpportunities.slice(0, 3)}
                onSelectJob={(job) => setSelectedJob(job)}
              />
            </section>
          )}
        </div>
      );
    }

    if (searchMode === 'profile') {
      if (loadingProfiles) {
        return (
          <div className="search-loading-text">
            Searching profiles...
          </div>
        );
      }
      if (asyncProfiles.length === 0) {
        return <EmptySearchState isNoResults query={searchQuery} mode={searchMode} />;
      }
      return (
        <ProfileSearchResults
          users={asyncProfiles}
          onSelectProfile={onSelectProfile}
          currentUserId={currentUserId}
        />
      );
    }

    if (searchMode === 'post') {
      if (loadingPosts) {
        return <div className="search-loading-text">Searching posts...</div>;
      }
      if (filteredPosts.length === 0) {
        return <EmptySearchState isNoResults query={searchQuery} mode={searchMode} />;
      }
      return (
        <div className="search-posts-stream">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="search-post-result-card"
              onClick={() => onNavigateToPostView && onNavigateToPostView(post.id, { activeTab: 'search' })}
            >
              <div className="card-top-row">
                <span className="search-domain-tag">{post.domain || 'Tech'}</span>
                <span className="post-time">{formatTimeAgo(post.created_at)}</span>
              </div>
              <h4>{post.title}</h4>
              <p className="post-snippet">{post.content?.substring(0, 160)}...</p>
              <div className="card-footer-row">
                <span className="post-author-name">By {post.author}</span>
                <span className="card-explore-btn">Open Post →</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (searchMode === 'domain') {
      if (!searchQuery.trim()) {
        return <DomainSearchResults domains={filteredDomains} onSelectDomain={onSelectDomain} />;
      }
      if (filteredDomains.length === 0) {
        return <EmptySearchState isNoResults query={searchQuery} mode={searchMode} />;
      }
      return (
        <DomainSearchResults
          domains={filteredDomains}
          onSelectDomain={onSelectDomain}
        />
      );
    }

    if (searchMode === 'job') {
      if (!searchQuery.trim()) {
        return (
          <JobSearchResults
            opportunities={filteredOpportunities}
            onSelectJob={(job) => setSelectedJob(job)}
          />
        );
      }
      if (filteredOpportunities.length === 0) {
        return <EmptySearchState isNoResults query={searchQuery} mode={searchMode} />;
      }
      return (
        <JobSearchResults
          opportunities={filteredOpportunities}
          onSelectJob={(job) => setSelectedJob(job)}
        />
      );
    }

    return null;
  };

  return (
    <div className="search-page-container">
      <div className="search-panel-card">
        {/* Search Header Bar */}
        <div className="search-header-area">
          <div className="search-page-heading-row">
            <h1 className="search-title">Explore & Search</h1>
          </div>

          <SearchModeSelector
            activeMode={searchMode}
            onSelectMode={handleModeChange}
          />

          <SearchInput
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              if (selectedJob) setSelectedJob(null);
            }}
            onClear={() => {
              setSearchQuery('');
              if (selectedJob) setSelectedJob(null);
            }}
            placeholder={getPlaceholder()}
          />
        </div>

        {/* Search Results Area */}
        <div className="search-body-area">{renderContent()}</div>
      </div>
    </div>
  );
}
