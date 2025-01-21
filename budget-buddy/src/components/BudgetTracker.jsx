// BudgetTracker.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';

const BudgetTracker = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('/api/transactions', {
          params: { user_id: process.env.REACT_APP_USER_ID }, // Pass user ID to backend
        });
        setTransactions(response.data);
      } catch (error) {
        console.error('Client Error fetching transactions:', error);
      }
    };

    fetchTransactions();
  }, []); // No need to include `process.env.REACT_APP_USER_ID` in the dependency array

  return (
    <div>
      <h1>Budget Tracker</h1>
      {transactions.map((transaction) => (
        <div key={transaction.transaction_id}>
          <p>{transaction.name}: ${transaction.amount}</p>
        </div>
      ))}
    </div>
  );
};

export default BudgetTracker;
