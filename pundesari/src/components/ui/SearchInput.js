import React from 'react';

const SearchInput = ({ value, onChange, placeholder = 'Cari...', disabled }) => (
  <div className="search-input" style={{ width: '100%', marginBottom: 16 }}>
    <input
      type="search"
      className="form-control"
      placeholder={placeholder}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  </div>
);

export default SearchInput;
