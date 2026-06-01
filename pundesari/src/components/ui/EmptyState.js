import React from 'react';

const EmptyState = ({ message = 'Tidak ada data', icon = '📭' }) => (
  <div style={{ textAlign: 'center', padding: 32, color: '#6c757d' }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 16 }}>{message}</div>
  </div>
);

export default EmptyState;
