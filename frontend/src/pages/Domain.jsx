import React from 'react';
import { initialChannels } from '../data/mockData';

export default function Domain({ domain, channels = initialChannels, onSelectChannel }) {
  const domainName = domain ? domain.name : 'Domain';
  const displayChannels = domain?.channels || channels;

  return (
    <div className="main-content">
      <div className="content-card">
        <h2 className="page-title">{domainName}</h2>
        <div className="list-container">
          {displayChannels.map((channel) => (
            <div
              key={channel.id}
              className="channel-card-item"
              onClick={() => onSelectChannel(channel)}
            >
              <span className="channel-item-title">{channel.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
