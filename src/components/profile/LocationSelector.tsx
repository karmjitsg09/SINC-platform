import React, { useState, useEffect, useRef } from 'react';
import {
  getCurrentCoordinates,
  reverseGeocode,
  searchLocations,
  formatDisplayLocation,
  NormalizedLocation
} from '../../lib/locationService';

export interface LocationSelectorProps {
  value?: Partial<NormalizedLocation> | Record<string, any> | string | null;
  onChange?: (location: NormalizedLocation) => void;
  errors?: Record<string, string>;
  label?: string;
}

export default function LocationSelector({
  value,
  onChange,
  errors: parentErrors = {},
  label = 'Location *'
}: LocationSelectorProps) {
  // Normalize initial value
  const valAny = value as any;
  const initialData: NormalizedLocation = typeof value === 'object' && value !== null
    ? {
        placeName: valAny?.placeName || valAny?.location_place_name || '',
        address: valAny?.address || valAny?.location_address || '',
        area: valAny?.area || valAny?.location_area || '',
        landmark: valAny?.landmark || valAny?.location_landmark || '',
        city: valAny?.city || valAny?.location_city || '',
        state: valAny?.state || valAny?.location_state || '',
        country: valAny?.country || valAny?.location_country || 'India',
        pincode: valAny?.pincode || valAny?.location_pincode || '',
        latitude: valAny?.latitude ?? valAny?.location_latitude ?? null,
        longitude: valAny?.longitude ?? valAny?.location_longitude ?? null,
        displayLocation: valAny?.displayLocation || valAny?.location || ''
      }
    : {
        placeName: '',
        address: '',
        area: '',
        landmark: '',
        city: '',
        state: '',
        country: 'India',
        pincode: '',
        latitude: null,
        longitude: null,
        displayLocation: typeof value === 'string' ? value : ''
      };

  const [locationData, setLocationData] = useState<NormalizedLocation>(initialData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLocating, setIsLocating] = useState(false);
  const [detectionNotice, setDetectionNotice] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Optional search auto-fill state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync external value
  useEffect(() => {
    if (value && typeof value === 'object') {
      setLocationData((prev) => ({
        ...prev,
        placeName: (value as any).placeName ?? (value as any).location_place_name ?? prev.placeName,
        address: (value as any).address ?? (value as any).location_address ?? prev.address,
        area: (value as any).area ?? (value as any).location_area ?? prev.area,
        landmark: (value as any).landmark ?? (value as any).location_landmark ?? prev.landmark,
        city: (value as any).city ?? (value as any).location_city ?? prev.city,
        state: (value as any).state ?? (value as any).location_state ?? prev.state,
        country: (value as any).country ?? (value as any).location_country ?? prev.country ?? 'India',
        pincode: (value as any).pincode ?? (value as any).location_pincode ?? prev.pincode,
        latitude: (value as any).latitude ?? (value as any).location_latitude ?? prev.latitude,
        longitude: (value as any).longitude ?? (value as any).location_longitude ?? prev.longitude,
        displayLocation: (value as any).displayLocation ?? (value as any).location ?? prev.displayLocation
      }));
    }
  }, [value]);

  // Combine internal and external field errors
  const errors = { ...fieldErrors, ...parentErrors };

  // Dismiss suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifyChange = (updated: NormalizedLocation) => {
    // Keep displayLocation updated
    updated.displayLocation = formatDisplayLocation({
      area: updated.area,
      city: updated.city,
      state: updated.state,
      country: updated.country,
      placeName: updated.landmark || updated.area
    });

    setLocationData(updated);
    if (onChange) {
      onChange(updated);
    }
  };

  const handleFieldChange = (field: keyof NormalizedLocation, val: any) => {
    const updated: NormalizedLocation = {
      ...locationData,
      [field]: val
    };

    // Clear field-specific error as user types
    if (fieldErrors[field] || parentErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    notifyChange(updated);
  };

  // 1. Device Geolocation Detection
  const handleUseCurrentLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    setDetectionNotice(null);

    try {
      const coords = await getCurrentCoordinates();
      const resolved = await reverseGeocode(coords.latitude, coords.longitude);

      if (resolved) {
        const updated: NormalizedLocation = {
          ...locationData,
          area: resolved.area || locationData.area || '',
          landmark: resolved.landmark || '',
          city: resolved.city || locationData.city || '',
          state: resolved.state || locationData.state || '',
          country: resolved.country || locationData.country || 'India',
          pincode: resolved.pincode || locationData.pincode || '',
          latitude: coords.latitude,
          longitude: coords.longitude,
          placeName: resolved.placeName || '',
          address: resolved.address || '',
          displayLocation: ''
        };

        notifyChange(updated);

        if (!resolved.landmark) {
          setDetectionNotice({
            type: 'warning',
            text: '✓ Location detected'
          });
          setFieldErrors((prev) => ({
            ...prev,
            landmark: 'Please enter a nearby landmark.'
          }));
        } else {
          setDetectionNotice({
            type: 'success',
            text: '✓ Location detected'
          });
          setFieldErrors({});
        }
      }
    } catch (err: any) {
      console.warn('[LocationSelector] Geolocation notice:', err?.message || err);
      setDetectionNotice({
        type: 'error',
        text: 'Unable to detect your location. Please enter your location manually.'
      });
    } finally {
      setIsLocating(false);
    }
  };

  // 2. Optional Search Suggestions
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!q.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchLocations(q);
        setSuggestions(res);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectSuggestion = (item: any) => {
    const updated: NormalizedLocation = {
      ...locationData,
      area: item.area || item.placeName || locationData.area,
      landmark: item.landmark || (item.placeName !== item.area ? item.placeName : '') || locationData.landmark,
      city: item.city || locationData.city,
      state: item.state || locationData.state,
      country: item.country || locationData.country || 'India',
      pincode: item.pincode || locationData.pincode,
      latitude: item.latitude,
      longitude: item.longitude,
      placeName: item.placeName || '',
      address: item.address || '',
      displayLocation: ''
    };

    notifyChange(updated);
    setSuggestions([]);
    setShowSearch(false);
    setSearchQuery('');
    setDetectionNotice({
      type: 'success',
      text: '✓ Location populated from search'
    });
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: `1.5px solid ${hasError ? '#ef4444' : '#dbeafe'}`,
    backgroundColor: '#ffffff',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Main Section Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: '700',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>{label}</span>
        </h3>

        {/* Optional Search Toggle Button */}
        <button
          type="button"
          onClick={() => setShowSearch((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '2px 6px'
          }}
        >
          {showSearch ? '✕ Close Search' : '🔍 Search Location'}
        </button>
      </div>

      {/* Optional Search Input for Auto-Fill */}
      {showSearch && (
        <div ref={searchContainerRef} style={{ position: 'relative', width: '100%' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontSize: '14px', color: '#64748b' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search area, locality, or university..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{
                width: '100%',
                padding: '10px 36px 10px 38px',
                borderRadius: '12px',
                border: '1.5px solid #b5d2fd',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
            {isSearching && (
              <span
                style={{
                  position: 'absolute',
                  right: '12px',
                  width: '14px',
                  height: '14px',
                  border: '2px solid #bfdbfe',
                  borderTopColor: '#2563eb',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
            )}
          </div>

          {suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                border: '1.5px solid #b5d2fd',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                maxHeight: '220px',
                overflowY: 'auto',
                zIndex: 1000,
                padding: '4px'
              }}
            >
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <strong style={{ color: '#1e293b' }}>{item.placeName || item.city}</strong>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    {[item.area, item.city, item.state, item.pincode].filter(Boolean).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detection Feedback Notice Banner */}
      {detectionNotice && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12.5px',
            fontWeight: '600',
            backgroundColor:
              detectionNotice.type === 'success'
                ? '#ecfdf5'
                : detectionNotice.type === 'warning'
                ? '#fffbeb'
                : '#fef2f2',
            color:
              detectionNotice.type === 'success'
                ? '#065f46'
                : detectionNotice.type === 'warning'
                ? '#92400e'
                : '#b91c1c',
            border: `1px solid ${
              detectionNotice.type === 'success'
                ? '#a7f3d0'
                : detectionNotice.type === 'warning'
                ? '#fde68a'
                : '#fecaca'
            }`
          }}
        >
          {detectionNotice.text}
        </div>
      )}

      {/* EXACT FIELD ORDER 1: Area / Street * */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
          Area / Street <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          id="location-area-input"
          placeholder="Enter area / street"
          value={locationData.area || ''}
          onChange={(e) => handleFieldChange('area', e.target.value)}
          style={inputStyle(Boolean(errors.area))}
        />
        {errors.area && (
          <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {errors.area}
          </span>
        )}
      </div>

      {/* EXACT FIELD ORDER 2: Landmark * */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
          Landmark <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          id="location-landmark-input"
          placeholder="Enter landmark"
          value={locationData.landmark || ''}
          onChange={(e) => handleFieldChange('landmark', e.target.value)}
          style={inputStyle(Boolean(errors.landmark))}
        />
        {errors.landmark && (
          <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {errors.landmark}
          </span>
        )}
      </div>

      {/* EXACT FIELD ORDER 3: City * */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
          City <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          id="location-city-input"
          placeholder="Enter city"
          value={locationData.city || ''}
          onChange={(e) => handleFieldChange('city', e.target.value)}
          style={inputStyle(Boolean(errors.city))}
        />
        {errors.city && (
          <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {errors.city}
          </span>
        )}
      </div>

      {/* EXACT FIELD ORDER 4: State * */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
          State <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          id="location-state-input"
          placeholder="Enter state"
          value={locationData.state || ''}
          onChange={(e) => handleFieldChange('state', e.target.value)}
          style={inputStyle(Boolean(errors.state))}
        />
        {errors.state && (
          <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {errors.state}
          </span>
        )}
      </div>

      {/* EXACT FIELD ORDER 5: Country * */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
          Country <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          id="location-country-input"
          placeholder="Enter country"
          value={locationData.country || ''}
          onChange={(e) => handleFieldChange('country', e.target.value)}
          style={inputStyle(Boolean(errors.country))}
        />
        {errors.country && (
          <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {errors.country}
          </span>
        )}
      </div>

      {/* EXACT FIELD ORDER 6: PIN Code * */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
          PIN Code <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          id="location-pincode-input"
          placeholder="Enter PIN code"
          value={locationData.pincode || ''}
          onChange={(e) => handleFieldChange('pincode', e.target.value)}
          style={inputStyle(Boolean(errors.pincode))}
        />
        {errors.pincode && (
          <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {errors.pincode}
          </span>
        )}
      </div>

      {/* USE MY CURRENT LOCATION BUTTON (Placed after the structured fields) */}
      <button
        type="button"
        id="use-current-location-btn"
        onClick={handleUseCurrentLocation}
        disabled={isLocating}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          width: '100%',
          padding: '12px 18px',
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          border: '1.5px solid #bfdbfe',
          borderRadius: '14px',
          fontSize: '13.5px',
          fontWeight: '700',
          cursor: isLocating ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.05)',
          marginTop: '4px'
        }}
        onMouseEnter={(e) => {
          if (!isLocating) {
            e.currentTarget.style.backgroundColor = '#dbeafe';
            e.currentTarget.style.borderColor = '#93c5fd';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLocating) {
            e.currentTarget.style.backgroundColor = '#eff6ff';
            e.currentTarget.style.borderColor = '#bfdbfe';
          }
        }}
      >
        <span style={{ fontSize: '16px' }}>📍</span>
        <span>{isLocating ? 'Detecting your location...' : 'Use my current location'}</span>
        {isLocating && (
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid #93c5fd',
              borderTopColor: '#1d4ed8',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.8s linear infinite'
            }}
          />
        )}
      </button>
    </div>
  );
}
