import React from 'react';

export interface OpportunityItem {
  id: string;
  title: string;
  company?: string;
  domainName?: string;
  type?: string;
  location?: string;
  description?: string;
  skills?: string[];
  requirements?: string[];
}

interface JobSearchResultsProps {
  opportunities?: OpportunityItem[];
  onSelectJob?: (job: OpportunityItem) => void;
  selectedJob?: OpportunityItem | null;
  onBackToResults?: () => void;
}

export default function JobSearchResults({
  opportunities = [],
  onSelectJob,
  selectedJob,
  onBackToResults
}: JobSearchResultsProps) {
  if (selectedJob) {
    return (
      <div className="job-detail-view">
        <button type="button" className="job-detail-back-btn" onClick={onBackToResults}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Search Results
        </button>

        <div className="job-detail-card">
          <div className="job-detail-header">
            <div>
              <h3 className="job-detail-title">{selectedJob.title}</h3>
              <div className="job-detail-meta">
                <span className="domain-badge">{selectedJob.domainName}</span>
                <span className="job-company">{selectedJob.company}</span>
                <span className="job-type">• {selectedJob.type}</span>
                <span className="job-location">• {selectedJob.location}</span>
              </div>
            </div>
          </div>

          <p className="job-detail-description">{selectedJob.description}</p>

          {selectedJob.skills && selectedJob.skills.length > 0 && (
            <div className="job-detail-section">
              <h4 className="section-subtitle">Required Skills</h4>
              <div className="job-skills-list">
                {selectedJob.skills.map((skill, idx) => (
                  <span key={idx} className="skill-pill highlight">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedJob.requirements && selectedJob.requirements.length > 0 && (
            <div className="job-detail-section">
              <h4 className="section-subtitle">Key Responsibilities</h4>
              <ul className="job-requirements-list">
                {selectedJob.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-list">
      {opportunities.map((job) => (
        <div
          key={job.id}
          className="search-card-item job-result-item"
          onClick={() => onSelectJob && onSelectJob(job)}
        >
          <div className="job-item-left">
            <div className="job-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div className="job-item-info">
              <div className="job-item-header">
                <span className="job-item-title">{job.title}</span>
                <span className="domain-badge">{job.domainName}</span>
              </div>
              <p className="job-item-desc">{job.description}</p>
              {job.skills && job.skills.length > 0 && (
                <div className="job-item-skills">
                  {job.skills.slice(0, 3).map((skill, idx) => (
                    <span key={idx} className="skill-pill">
                      {skill}
                    </span>
                  ))}
                </div>
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
