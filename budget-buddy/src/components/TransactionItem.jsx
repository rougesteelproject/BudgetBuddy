import React from 'react';

function TransactionItem({ transaction }) {
  return (
    <div style={{ marginBottom: '5px' }}>
      <strong>{transaction.name}</strong> - ${transaction.amount.toFixed(2)} 
      <span style={{ color: 'gray', marginLeft: '10px' }}>
        ({transaction.date})
      </span>
    </div>
  );
}

export default TransactionItem;
