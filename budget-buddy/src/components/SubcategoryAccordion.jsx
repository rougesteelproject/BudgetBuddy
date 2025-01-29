import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Accordion, AccordionSummary, AccordionDetails, Typography, TextField, Button, Switch, FormControlLabel, Select, MenuItem, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TransactionItem from './TransactionItem';

const SubcategoryAccordion = ({ subcategory, transactions = [], editMode, categories = [], onPriorityChange }) => {
  const [subcategoryName, setSubcategoryName] = useState(subcategory.name);
  const [subcategoryLimit, setSubcategoryLimit] = useState(subcategory.category_limit);
  const [subcategoryPriority, setSubcategoryPriority] = useState(subcategory.priority_value);
  const [isEarmarked, setIsEarmarked] = useState(subcategory.earmark);

  const handleNameChange = (e) => setSubcategoryName(e.target.value);
  const handleLimitChange = (e) => setSubcategoryLimit(e.target.value);
  const handlePriorityChange = (e) => {
    const newPriorityValue = parseInt(e.target.value, 10);
    setSubcategoryPriority(newPriorityValue);
    onPriorityChange(subcategory.id, newPriorityValue);
  };
  const handleEarmarkChange = () => setIsEarmarked(!isEarmarked);

  const saveSubcategoryChanges = async () => {
    try {
      await axios.put(`/categories/${subcategory.id}`, {
        name: subcategoryName,
        category_limit: subcategoryLimit,
        priority_value: subcategoryPriority,
        earmark: isEarmarked,
      });
      // Optionally, refresh the data or show a success message
    } catch (error) {
      console.error('Error saving subcategory changes:', error);
    }
  };

  useEffect(() => {
    console.log('Transactions for subcategory:', transactions);
  }, [transactions]);

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">
          {subcategory.name}
        </Typography>
        <Tooltip title={`Total: ${subcategory.total}, Earmark: ${subcategory.earmark}, Limit: ${subcategory.category_limit}, Priority Expenses: ${subcategory.priority_expenses}`}>
          <Typography variant="body2" color="text.secondary" style={{ marginLeft: '1rem' }}>
            Total: ${subcategory.total}, Limit: ${subcategory.category_limit}, Priority: {subcategory.priority_value}
          </Typography>
        </Tooltip>
      </AccordionSummary>
      <AccordionDetails>
        {editMode ? (
          <div>
            <TextField label="Subcategory Name" value={subcategoryName} onChange={handleNameChange} />
            <TextField label="Subcategory Limit" type="number" value={subcategoryLimit} onChange={handleLimitChange} />
            <TextField label="Priority Value" type="number" value={subcategoryPriority} onChange={handlePriorityChange} />
            <FormControlLabel
              control={<Switch checked={isEarmarked} onChange={handleEarmarkChange} />}
              label="Earmarked"
            />
            <Button variant="contained" color="primary" onClick={saveSubcategoryChanges}>
              Save
            </Button>
          </div>
        ) : null}
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} categories={categories} editMode={editMode} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No transactions for this subcategory.
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default SubcategoryAccordion;