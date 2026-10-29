import { useState } from 'react';

/** Marca de agua fija con el crédito de diseño y desarrollo. Se muestra en todas las pantallas, incluido el login. */
export function MarcaAgua(): JSX.Element {
  const [hover, setHover] = useState(false);
  const [hoverEnlace, setHoverEnlace] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: '#0f172a',
        color: '#f8fafc',
        padding: '8px 16px',
        borderRadius: 9999,
        fontSize: 12,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        border: `1px solid ${hover ? 'rgba(217, 119, 6, 0.8)' : 'rgba(217, 119, 6, 0.3)'}`,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.3s ease',
      }}
    >
      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
        {'</>'}
      </span>

      <span style={{ color: '#94a3b8', fontWeight: 400 }}>
        Design &amp; Code by
        <a
          href="https://germanrodriguez.ar"
          target="_blank"
          rel="noreferrer"
          onMouseEnter={() => setHoverEnlace(true)}
          onMouseLeave={() => setHoverEnlace(false)}
          style={{
            color: hoverEnlace ? '#f59e0b' : '#ffffff',
            textDecoration: 'none',
            fontWeight: 700,
            marginLeft: 2,
            transition: 'color 0.2s',
          }}
        >
          <span style={{ color: '#f59e0b' }}>G</span>R
        </a>
      </span>
    </div>
  );
}
