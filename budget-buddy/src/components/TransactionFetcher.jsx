import React, { useEffect, useState } from 'react';

const TransactionFetcher = () => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        setTransactions(data.transactions);
        setCategories(data.categories);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    };

    fetchTransactions();
  }, []);

  return (
    <div>
      <h2>Transactions</h2>
      <ul>
        {transactions.map((transaction) => (
          <li key={transaction.id}>
            {transaction.name}: ${transaction.amount} on {transaction.date}
          </li>
        ))}
      </ul>
      <h2>Categories</h2>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>{category.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default TransactionFetcher;
