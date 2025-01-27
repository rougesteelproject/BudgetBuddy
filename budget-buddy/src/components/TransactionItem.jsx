import React, { useState } from 'react';
import { Typography, Select, MenuItem, Button } from '@mui/material';
import axios from 'axios';

const TransactionItem = ({ transaction, categories, editMode }) => {
  const [newCategoryId, setNewCategoryId] = useState(transaction.category_id);

  const handleCategoryChange = (e) => setNewCategoryId(e.target.value);

  const saveTransactionCategory = async () => {
    try {
      await axios.put(`/api/transactions/${transaction.id}/change-category`, { category_id: newCategoryId });
      // Optionally, refresh the data or show a success message
    } catch (error) {
      console.error('Error changing transaction category:', error);
    }
  };

  return (
    <div>
      <Typography variant="body1" style={{ marginLeft: '1rem' }}>
        {transaction.name}: ${transaction.amount}
      </Typography>
      {editMode && (
        <div>
          <Select value={newCategoryId} onChange={handleCategoryChange}>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
          <Button variant="contained" color="primary" onClick={saveTransactionCategory}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
};

export default TransactionItem;