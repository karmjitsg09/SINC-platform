import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

export interface SkillMultiSelectProps {
  label?: string;
  helper?: string;
  options?: string[];
  selected?: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  id?: string;
}

/**
 * SkillMultiSelect — Reusable searchable multi-select dropdown component.
 */
export default function SkillMultiSelect({
  label,
  helper,
  options = [],
  selected = [],
  onChange,
  placeholder = 'Search or select...',
  id
}: SkillMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionListRef = useRef<HTMLDivElement | null>(null);

  // Normalize for comparison
  const normalize = (s?: string) => (s || '').trim().toLowerCase();

  // Build the deduplicated set of all known options (predefined + any selected custom values)
  const allKnownOptions = useMemo(() => {
    const set = new Map<string, string>();
    options.forEach((o) => set.set(normalize(o), o));
    selected.forEach((s) => {
      const key = normalize(s);
      if (!set.has(key)) set.set(key, s);
    });
    return Array.from(set.values());
  }, [options, selected]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return allKnownOptions;
    const q = normalize(search);
    return allKnownOptions.filter((o) => normalize(o).includes(q));
  }, [search, allKnownOptions]);

  // Check if custom add is possible
  const canAddCustom = useMemo(() => {
    if (!search.trim()) return false;
    const q = normalize(search);
    // Already selected?
    if (selected.some((s) => normalize(s) === q)) return false;
    // Exact match in options?
    if (allKnownOptions.some((o) => normalize(o) === q)) return false;
    return true;
  }, [search, selected, allKnownOptions]);

  // Total items visible in the dropdown (filtered + optional custom)
  const totalItems = filteredOptions.length + (canAddCustom ? 1 : 0);

  const isSelected = useCallback(
    (opt: string) => selected.some((s) => normalize(s) === normalize(opt)),
    [selected]
  );

  const toggleOption = useCallback(
    (opt: string) => {
      const key = normalize(opt);
      if (selected.some((s) => normalize(s) === key)) {
        onChange(selected.filter((s) => normalize(s) !== key));
      } else {
        onChange([...selected, opt]);
      }
    },
    [selected, onChange]
  );

  const addCustom = useCallback(() => {
    const val = search.trim();
    if (!val) return;
    if (!selected.some((s) => normalize(s) === normalize(val))) {
      onChange([...selected, val]);
    }
    setSearch('');
    setHighlightIdx(-1);
  }, [search, selected, onChange]);

  const removeTag = useCallback(
    (idx: number) => {
      onChange(selected.filter((_, i) => i !== idx));
    },
    [selected, onChange]
  );

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlight when search/options change
  useEffect(() => {
    setHighlightIdx(-1);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && optionListRef.current) {
      const items = optionListRef.current.querySelectorAll<HTMLElement>('[data-option-idx]');
      if (items[highlightIdx]) {
        items[highlightIdx].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
      setHighlightIdx(-1);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filteredOptions.length) {
        toggleOption(filteredOptions[highlightIdx]);
      } else if (highlightIdx === filteredOptions.length && canAddCustom) {
        addCustom();
      } else if (canAddCustom) {
        addCustom();
      }
      return;
    }

    if (e.key === 'Backspace' && search === '' && selected.length > 0) {
      removeTag(selected.length - 1);
    }
  };

  const containerUniqueId = id || `skill-multi-select-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}
      id={containerUniqueId}
    >
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label
          style={{
            fontSize: '13.5px',
            fontWeight: '700',
            color: '#1e3860'
          }}
          htmlFor={`${containerUniqueId}-trigger`}
        >
          {label}
        </label>
        {helper && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>{helper}</span>
        )}
      </div>

      {/* Trigger / Selected chips + chevron */}
      <div
        id={`${containerUniqueId}-trigger`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${containerUniqueId}-listbox`}
        aria-label={label}
        tabIndex={0}
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: '42px',
          padding: '8px 36px 8px 10px',
          borderRadius: '10px',
          border: `1.5px solid ${isOpen ? '#2563eb' : '#cbd5e1'}`,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          boxSizing: 'border-box',
          position: 'relative',
          transition: 'border-color 0.15s ease',
          outline: 'none'
        }}
      >
        {selected.length === 0 && !isOpen && (
          <span style={{ color: '#94a3b8', fontSize: '13.5px', userSelect: 'none' }}>
            {placeholder}
          </span>
        )}

        {selected.map((val, idx) => (
          <span
            key={`${normalize(val)}-${idx}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '12.5px',
              fontWeight: '600',
              maxWidth: '180px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(idx);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: '#3b82f6',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                lineHeight: 1
              }}
              aria-label={`Remove ${val}`}
            >
              ✕
            </button>
          </span>
        ))}

        {/* Chevron */}
        <span
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
            transition: 'transform 0.2s ease',
            color: '#64748b',
            fontSize: '12px',
            pointerEvents: 'none',
            lineHeight: 1
          }}
        >
          ▼
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: '4px',
            backgroundColor: '#ffffff',
            border: '1.5px solid #b5d2fd',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          role="listbox"
          id={`${containerUniqueId}-listbox`}
          aria-label={`${label} options`}
        >
          {/* Search input inside dropdown */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '14px', flexShrink: 0 }}>🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '13.5px',
                color: '#1e3860',
                backgroundColor: 'transparent',
                padding: 0
              }}
              aria-label={`Search ${label}`}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '14px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Options list */}
          <div
            ref={optionListRef}
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {filteredOptions.length === 0 && !canAddCustom && (
              <div
                style={{
                  padding: '16px 14px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                No matching options.
              </div>
            )}

            {filteredOptions.map((opt, idx) => {
              const checked = isSelected(opt);
              const highlighted = highlightIdx === idx;
              return (
                <div
                  key={normalize(opt)}
                  data-option-idx={idx}
                  role="option"
                  aria-selected={checked}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(opt);
                    searchInputRef.current?.focus();
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 14px',
                    cursor: 'pointer',
                    backgroundColor: highlighted ? '#f0f7ff' : checked ? '#f8fbff' : '#ffffff',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.1s ease',
                    fontSize: '13.5px',
                    color: checked ? '#1e40af' : '#334155',
                    fontWeight: checked ? '700' : '500'
                  }}
                >
                  {/* Checkbox indicator */}
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: `1.5px solid ${checked ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: checked ? '#2563eb' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                  >
                    {checked && '✓'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt}
                  </span>
                </div>
              );
            })}

            {/* Custom add option */}
            {canAddCustom && (
              <div
                data-option-idx={filteredOptions.length}
                role="option"
                aria-selected={false}
                onClick={(e) => {
                  e.stopPropagation();
                  addCustom();
                  searchInputRef.current?.focus();
                }}
                onMouseEnter={() => setHighlightIdx(filteredOptions.length)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  backgroundColor: highlightIdx === filteredOptions.length ? '#f0fdf4' : '#ffffff',
                  borderTop: filteredOptions.length > 0 ? '1px solid #e2e8f0' : 'none',
                  fontSize: '13.5px',
                  color: '#059669',
                  fontWeight: '700',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <span style={{ fontSize: '15px' }}>+</span>
                <span>Add "{search.trim()}"</span>
              </div>
            )}
          </div>

          {/* Selected count footer */}
          {selected.length > 0 && (
            <div
              style={{
                padding: '8px 14px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '12px',
                color: '#64748b',
                fontWeight: '600',
                backgroundColor: '#f8fafc'
              }}
              aria-live="polite"
            >
              {selected.length} selected
            </div>
          )}
        </div>
      )}

      {/* Hide scrollbar inside dropdown */}
      <style>{`
        #${containerUniqueId} [role="listbox"] > div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
