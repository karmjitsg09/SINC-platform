import React, { useState, useEffect } from 'react';
import SearchModeSelector from '../components/SearchModeSelector';
import SearchInput from '../components/SearchInput';
import ProfileSearchResults from '../components/ProfileSearchResults';
import DomainSearchResults from '../components/DomainSearchResults';
import JobSearchResults from '../components/JobSearchResults';
import EmptySearchState from '../components/EmptySearchState';

import { domains as allDomains, users as allUsers, opportunities as allOpportunities } from '../data/mockData';
import { searchProfiles } from '../lib/socialService';
import { useAuth } from '../context/AuthContext';

export default function Search({ onSelectDomain, onSelectProfile }) {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [searchMode, setSearchMode] = useState('profile'); // 'profile' | 'domain' | 'job'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  const [asyncProfiles, setAsyncProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfiles() {
      if (searchMode === 'profile') {
        setLoadingProfiles(true);
        const results = await searchProfiles(searchQuery, currentUserId);
        if (isMounted) {
          setAsyncProfiles(results);
          setLoadingProfiles(false);
        }
      }
    }

    fetchProfiles();

    return () => {
      isMounted = false;
    };
  }, [searchQuery, searchMode, currentUserId]);

  const handleModeChange = (mode) => {
    setSearchMode(mode);
    setSelectedJob(null);
  };

  const getPlaceholder = () => {
    switch (searchMode) {
      case 'profile':
        return 'Search profiles by name, @username, skill, role...';
      case 'domain':
        return 'Search domains...';
      case 'job':
        return 'Search job or role...';
      default:
        return 'Search...';
    }
  };

  // Filter fallback users with @ symbol stripping
  const qClean = searchQuery.replace(/^@/, '').toLowerCase().trim();

  const filteredDomains = allDomains.filter((d) => {
    if (!qClean) return true;
    const matchName = d.name.toLowerCase().includes(qClean);
    const matchDesc = d.feed?.descriptionTop?.toLowerCase().includes(qClean);
    return matchName || matchDesc;
  });

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

    if (searchMode === 'profile') {
      if (loadingProfiles) {
        return (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
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

    if (searchMode === 'domain') {
      if (!searchQuery.trim()) {
        return <EmptySearchState mode={searchMode} />;
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
        return <EmptySearchState mode={searchMode} />;
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
    <div className="main-content">
      <div className="content-card search-content-card">
        <div className="search-header-area">
          <h2 className="page-title" style={{ marginBottom: '14px' }}>Search</h2>
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

        <div className="search-body-area">{renderContent()}</div>
      </div>
    </div>
  );
}
