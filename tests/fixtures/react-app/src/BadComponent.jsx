import React, { useState, useEffect } from 'react';

export default function BadComponent({ items }) {
  const [user, setUser] = useState({ name: '', age: 0 });

  // RULE: react/use-effect-no-deps
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setUser);
  });

  function handleSave() {
    // RULE: react/use-state-object-without-spread
    setUser({ name: 'new' });
  }

  return (
    <div
      // RULE: react/no-inline-object-in-jsx
      style={{ padding: 20, color: 'red' }}
    >
      <ul>
        {items.map((item, idx) => <li key={idx}>{item.name}</li>)}
      </ul>
      <button
        // RULE: react/no-inline-function-in-jsx
        onClick={() => handleSave()}
      >
        Save
      </button>
    </div>
  );
}
