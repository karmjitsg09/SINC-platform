import React, { useState, useEffect, useCallback } from 'react';
import { getUpdates, subscribeToUpdates } from '../../lib/profileItemUpdateService';

function formatSnippetDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function ProfileItemUpdatesSnippet({
  itemType,
  itemId,
  item,
  onViewAllUpdates,
  isOwner,
  onAddUpdate
}) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSnippetUpdates = useCallback(async () => {
    if (!itemType || !itemId) return;
    try {
      const data = await getUpdates(itemType, itemId);
      setUpdates(data || []);
    } catch (e) {
      console.warn('[ProfileItemUpdatesSnippet] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [itemType, itemId]);

  useEffect(() => {
    fetchSnippetUpdates();
    const unsub = subscribeToUpdates((evt) => {
      if (!evt.itemType || (evt.itemType === itemType && evt.itemId === itemId) || evt.type === 'create' || evt.type === 'update' || evt.type === 'delete') {
        fetchSnippetUpdates();
      }
    });
    return () => unsub();
  }, [fetchSnippetUpdates, itemType, itemId]);

  if (loading) return null;

  if (updates.length === 0) {
    return (
      <div
        style={{
          marginTop: '6px',
          paddingTop: '8px',
          borderTop: '1px solid #edf2f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          color: '#94a3b8'
        }}
      >
        <span>No updates yet.</span>
        {isOwner && onAddUpdate && (
          <button
            type="button"
            onClick={() => onAddUpdate(itemType, item)}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontWeight: '600',
              fontSize: '11.5px',
              cursor: 'pointer',
              padding: 0
            }}
          >
            + Add update
          </button>
        )}
      </div>
    );
  }

  const recentUpdates = updates.slice(0, 2);

  return (
    <div
      style={{
        marginTop: '8px',
        paddingTop: '10px',
        borderTop: '1px solid #edf2f7',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4px' }}>
          Recent Updates
        </span>
        <button
          type="button"
          onClick={() => onViewAllUpdates && onViewAllUpdates(itemType, item)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontWeight: '700',
            fontSize: '11.5px',
            cursor: 'pointer',
            padding: 0
          }}
        >
          View All Updates ({updates.length}) →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {recentUpdates.map((u) => (
          <div
            key={u.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#334155',
              padding: '4px 8px',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #f1f5f9'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: u.status === 'Completed' ? '#16a34a' : '#2563eb',
                  flexShrink: 0
                }}
              />
              <span style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.title || u.content}
              </span>
            </div>
            <span style={{ fontSize: '10.5px', color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }}>
              {formatSnippetDate(u.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
