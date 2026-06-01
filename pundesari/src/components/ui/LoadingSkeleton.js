import React from 'react';

const LoadingSkeleton = ({ rows = 4 }) => (
  <div className="loading-skeleton" style={{ display: 'grid', gap: 12 }}>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        style={{
          height: 44,
          borderRadius: 8,
          background: '#e9ecef',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
    ))}
    <style>{`
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: .55; }
        100% { opacity: 1; }
      }
    `}</style>
  </div>
);

export default LoadingSkeleton;
