import React, { useState, useEffect, useCallback, memo } from 'react';

const STYLE = { padding: 20, color: 'red' };

function GoodComponent({ items, userId }) {
  const [user, setUser] = useState({ name: '', age: 0 });

  useEffect(() => {
    fetch('/api/data/' + userId).then(r => r.json()).then(setUser);
  }, [userId]);

  const handleSave = useCallback(() => {
    setUser(prev => ({ ...prev, name: 'new' }));
  }, []);

  return (
    <div style={STYLE}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default memo(GoodComponent);
