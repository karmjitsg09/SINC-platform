import React, { useState } from 'react';

// Resolves a media_url that might be a complete URL, a Supabase Storage path, or DataURL
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string' || url === '[object Object]') return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  // Supabase storage object path (e.g. "posts/userId/postId/photo.jpg" or "post-media/posts/...")
  const cleanPath = trimmed.replace(/^\/?(post-media\/)?/, '');
  return `https://vctwzlsatqsuinmosnzo.supabase.co/storage/v1/object/public/post-media/${cleanPath}`;
}

export default function PostMedia({
  media = [],
  layout = 'single',
  legacyImageUrl = null,
  legacyVideoUrl = null,
  postType = 'image',
  postId = null
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [brokenMediaMap, setBrokenMediaMap] = useState({});

  // 1. Normalize media items: support normalized media array, JSON legacy string, and single legacy URLs
  let items = [];

  if (Array.isArray(media) && media.length > 0) {
    items = [...media];
  } else if (legacyImageUrl && typeof legacyImageUrl === 'string' && legacyImageUrl.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(legacyImageUrl);
      if (Array.isArray(parsed) && parsed.length > 0) {
        items = parsed;
      }
    } catch (e) {
      items = [{ id: 'leg-img', media_type: 'image', media_url: legacyImageUrl, display_order: 0, layout_type: 'single' }];
    }
  } else if (legacyVideoUrl) {
    items = [{ id: 'leg-vid', media_type: 'video', media_url: legacyVideoUrl, display_order: 0, layout_type: 'single' }];
  } else if (legacyImageUrl) {
    items = [{ id: 'leg-img', media_type: 'image', media_url: legacyImageUrl, display_order: 0, layout_type: 'single' }];
  }

  // Filter out any items with missing or invalid media_url
  items = items.filter((item) => item && (item.media_url || item.url || item.previewUrl));

  // Sort strictly by display_order
  items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  if (items.length === 0) return null;

  // 2. Determine robust layout type
  const effectiveLayout =
    layout ||
    items.find((m) => m.layout_type)?.layout_type ||
    (items.length > 1 ? 'collage' : 'single');

  const markBroken = (key) => {
    setBrokenMediaMap((prev) => ({ ...prev, [key]: true }));
  };

  // Helper to render individual image with clean fallback if broken
  const renderItemImage = (item, idx, extraStyle = {}, altText = '') => {
    const rawUrl = item.media_url || item.url || item.previewUrl;
    const resolvedUrl = resolveMediaUrl(rawUrl);
    const itemKey = item.id || `${idx}_${rawUrl}`;
    const isBroken = brokenMediaMap[itemKey] || !resolvedUrl;

    if (isBroken) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '140px',
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            ...extraStyle
          }}
        >
          <span style={{ fontSize: '20px' }}>🖼️</span>
          <span>Image unavailable</span>
        </div>
      );
    }

    return (
      <img
        src={resolvedUrl}
        alt={altText || `Attachment ${idx + 1}`}
        onError={() => markBroken(itemKey)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...extraStyle
        }}
      />
    );
  };

  // ==========================================
  // CASE A: SINGLE VIDEO
  // ==========================================
  if (items.length === 1 && items[0].media_type === 'video') {
    const resolvedVideoUrl = resolveMediaUrl(items[0].media_url || items[0].url);
    return (
      <div style={{ marginTop: '12px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color, #263750)', backgroundColor: '#000000' }}>
        <video
          src={resolvedVideoUrl}
          controls
          style={{
            width: '100%',
            maxWidth: '100%',
            maxHeight: 'clamp(260px, 50vh, 520px)',
            height: 'auto',
            display: 'block'
          }}
        />
      </div>
    );
  }

  // ==========================================
  // CASE B: SINGLE IMAGE
  // ==========================================
  if (items.length === 1 || effectiveLayout === 'single') {
    const single = items[0];
    const resolvedUrl = resolveMediaUrl(single.media_url || single.url);
    const isBroken = brokenMediaMap[single.id || 'single'] || !resolvedUrl;

    return (
      <div
        style={{
          marginTop: '12px',
          borderRadius: '14px',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #263750)',
          backgroundColor: 'var(--bg-elevated, #101c2d)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {single.media_type === 'video' ? (
          <video
            src={resolvedUrl}
            controls
            style={{ width: '100%', maxWidth: '100%', maxHeight: 'clamp(260px, 50vh, 520px)', height: 'auto', display: 'block' }}
          />
        ) : isBroken ? (
          <div
            style={{
              padding: '40px 20px',
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <span style={{ fontSize: '24px' }}>🖼️</span>
            <span>Image unavailable</span>
          </div>
        ) : (
          <img
            src={resolvedUrl}
            alt="Post attachment"
            onError={() => markBroken(single.id || 'single')}
            style={{
              width: '100%',
              maxWidth: '100%',
              height: 'auto',
              maxHeight: 'clamp(280px, 55vh, 600px)',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        )}
      </div>
    );
  }

  // ==========================================
  // CASE C: SWIPEABLE PHOTOS / CAROUSEL
  // ==========================================
  if (effectiveLayout === 'carousel') {
    const total = items.length;
    const safeIndex = Math.max(0, Math.min(currentIndex, total - 1));
    const current = items[safeIndex] || items[0];

    const handlePrev = (e) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    };

    const handleNext = (e) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => Math.min(total - 1, prev + 1));
    };

    // Touch swipe handlers (respecting vertical scrolling)
    const onTouchStart = (e) => {
      setTouchEndX(null);
      setTouchStartX(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
      setTouchEndX(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
      if (touchStartX === null || touchEndX === null) return;
      const distance = touchStartX - touchEndX;
      const minSwipeDistance = 40;
      if (distance > minSwipeDistance && safeIndex < total - 1) {
        handleNext();
      } else if (distance < -minSwipeDistance && safeIndex > 0) {
        handlePrev();
      }
    };

    return (
      <div
        className="post-media-carousel"
        style={{
          marginTop: '12px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #263750)',
          backgroundColor: 'var(--bg-elevated, #0f172a)',
          position: 'relative',
          userSelect: 'none'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main Current Slide Container */}
        <div
          style={{
            width: '100%',
            height: '380px',
            maxHeight: 'clamp(280px, 45vh, 460px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            backgroundColor: '#020617'
          }}
        >
          {current.media_type === 'video' ? (
            <video
              src={resolveMediaUrl(current.media_url || current.url)}
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            renderItemImage(
              current,
              safeIndex,
              { objectFit: 'contain' },
              `Photo ${safeIndex + 1} of ${total}`
            )
          )}

          {/* Left Arrow Button (Hidden/Disabled on first image) */}
          {safeIndex > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous image"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                zIndex: 10,
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.95)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.7)')}
            >
              ‹
            </button>
          )}

          {/* Right Arrow Button (Hidden/Disabled on last image) */}
          {safeIndex < total - 1 && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next image"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                zIndex: 10,
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.95)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.7)')}
            >
              ›
            </button>
          )}

          {/* Top-Right Position Counter Badge */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 9px',
              borderRadius: '12px',
              letterSpacing: '0.5px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              zIndex: 10
            }}
          >
            {safeIndex + 1} / {total}
          </div>
        </div>

        {/* Bottom Dot Pagination */}
        {total > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 0',
              backgroundColor: 'rgba(15, 23, 42, 0.95)'
            }}
          >
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: idx === safeIndex ? '18px' : '7px',
                  height: '7px',
                  borderRadius: '4px',
                  backgroundColor: idx === safeIndex ? '#38bdf8' : '#64748b',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // CASE D: COLLAGE (2, 3, 4, 5+ IMAGES)
  // ==========================================
  const count = items.length;

  return (
    <div
      className={`post-collage collage-${count}`}
      style={{
        marginTop: '12px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid var(--border-color, #263750)',
        backgroundColor: 'var(--bg-elevated, #0f172a)'
      }}
    >
      {/* 2 IMAGES COLLAGE */}
      {count === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', height: '280px' }}>
          {items.map((img, idx) => (
            <div key={img.id || idx} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderItemImage(img, idx, {}, `Collage image ${idx + 1}`)}
            </div>
          ))}
        </div>
      )}

      {/* 3 IMAGES COLLAGE */}
      {count === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '3px', height: '310px' }}>
          {/* Big left image */}
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderItemImage(items[0], 0, {}, 'Collage image 1')}
          </div>
          {/* 2 stacked right images */}
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '3px', height: '100%' }}>
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderItemImage(items[1], 1, {}, 'Collage image 2')}
            </div>
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderItemImage(items[2], 2, {}, 'Collage image 3')}
            </div>
          </div>
        </div>
      )}

      {/* 4 IMAGES COLLAGE */}
      {count === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '3px', height: '320px' }}>
          {items.map((img, idx) => (
            <div key={img.id || idx} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderItemImage(img, idx, {}, `Collage image ${idx + 1}`)}
            </div>
          ))}
        </div>
      )}

      {/* 5+ IMAGES COLLAGE */}
      {count >= 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', height: '340px' }}>
          {/* Top row: 2 images */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', height: '55%' }}>
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderItemImage(items[0], 0, {}, 'Collage image 1')}
            </div>
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderItemImage(items[1], 1, {}, 'Collage image 2')}
            </div>
          </div>
          {/* Bottom row: 3 images */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px', height: '45%' }}>
            {items.slice(2, 5).map((img, idx) => (
              <div key={img.id || idx} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                {renderItemImage(img, idx + 2, {}, `Collage image ${idx + 3}`)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
