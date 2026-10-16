import React from 'react';
import { TrendingUp, Hash, Flame } from 'lucide-react';
import { FEED_CATEGORIES } from '../data/mockData';

export default function TrendingTopicsWidget({
  selectedCategory,
  onSelectCategory
}) {
  const trendingTopics = [
    {
      id: 'ai',
      tag: '#AutonomousAgents',
      domain: 'AI',
      postsCount: '4.2k posts',
      trend: '+28% this week'
    },
    {
      id: 'tech',
      tag: '#CloudArchitecture',
      domain: 'Tech',
      postsCount: '3.1k posts',
      trend: '+15% this week'
    },
    {
      id: 'design',
      tag: '#DesignSystems',
      domain: 'Design',
      postsCount: '2.4k posts',
      trend: '+12% this week'
    },
    {
      id: 'ml',
      tag: '#VectorDatabases',
      domain: 'Machine Learning',
      postsCount: '1.9k posts',
      trend: '+19% this week'
    },
    {
      id: 'cybersecurity',
      tag: '#ZeroTrustSecurity',
      domain: 'Cybersecurity',
      postsCount: '1.5k posts',
      trend: '+8% this week'
    }
  ];

  return (
    <div className="right-widget-card trending-topics-widget">
      <div className="widget-header">
        <div className="widget-header-title">
          <TrendingUp size={17} className="widget-icon text-blue" />
          <h3>Trending Topics</h3>
        </div>
        <span className="widget-badge">Live</span>
      </div>

      <div className="trending-list">
        {trendingTopics.map((item) => {
          const isSelected = selectedCategory === item.id;

          return (
            <div
              key={item.id}
              className={`trending-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectCategory && onSelectCategory(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelectCategory(item.id); }}
            >
              <div className="trending-item-content">
                <div className="trending-item-domain-row">
                  <span className="trending-domain-label">{item.domain}</span>
                  <span className="trending-growth">{item.trend}</span>
                </div>
                <div className="trending-tag-name">
                  <Hash size={13} className="hash-icon" />
                  <span>{item.tag.replace(/^#/, '')}</span>
                </div>
                <span className="trending-post-count">{item.postsCount}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
