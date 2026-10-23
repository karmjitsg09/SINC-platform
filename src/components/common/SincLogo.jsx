import React from 'react';

/**
 * SINC Platform — Official Corporate Logo Component
 * Renders the official "Glossy Blue SINC Corporate Emblem" (/images/sinc-corporate-logo.png).
 * Preserves the 1:1 aspect ratio with object-fit: contain.
 */
export default function SincLogo({
  size = 'md', // 'xs' (20px), 'sm' (28px), 'md' (36px), 'lg' (52px), 'xl' (68px), '2xl' (84px), or custom number (px)
  className = '',
  style = {},
  alt = 'SINC logo',
  priority = true,
  onClick = null,
  role = undefined
}) {
  const sizeMap = {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 52,
    xl: 68,
    '2xl': 84
  };

  const dimension = typeof size === 'number' ? size : (sizeMap[size] || 36);

  return (
    <img
      src="/images/sinc-corporate-logo.png"
      alt={alt}
      width={dimension}
      height={dimension}
      className={`sinc-corporate-logo ${className}`}
      onClick={onClick}
      role={role}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={{
        width: `${dimension}px`,
        height: `${dimension}px`,
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style
      }}
    />
  );
}
