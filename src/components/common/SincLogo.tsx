import React from 'react';

export interface SincLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  priority?: boolean;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  role?: string;
}

/**
 * SINC Platform — Official Brand Logo Component
 * Renders the official "Glossy Blue Triadic Connection Emblem" (/images/sinc-official-logo.png).
 * Preserves the 1:1 aspect ratio with object-fit: contain.
 */
export default function SincLogo({
  size = 'md',
  className = '',
  style = {},
  alt = 'SINC logo',
  priority = true,
  onClick,
  role
}: SincLogoProps) {
  const sizeMap: Record<string, number> = {
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
      src="/images/sinc-official-logo-transparent.png"
      alt={alt}
      width={dimension}
      height={dimension}
      className={`sinc-official-logo sinc-corporate-logo ${className}`}
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
