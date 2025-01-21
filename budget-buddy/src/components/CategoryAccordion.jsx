import React, { useState } from 'react';
import TransactionItem from './TransactionItem';

function CategoryAccordion({ data }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAccordion = () => setIsOpen(!isOpen);

  return (
    <div style={{ marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <button
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: isOpen ? '#f0f0f0' : '#fff',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
        onClick={toggleAccordion}
      >
        {data.category} (Total: $
        {data.transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)})
      </button>
      {isOpen && (
        <div style={{ padding: '10px', borderTop: '1px solid #ddd' }}>
          {data.transactions.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryAccordion;
