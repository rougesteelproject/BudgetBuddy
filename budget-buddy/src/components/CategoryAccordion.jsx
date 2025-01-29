import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Accordion, AccordionSummary, AccordionDetails, Typography, TextField, Button, Switch, FormControlLabel, Select, MenuItem, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TransactionItem from './TransactionItem';
import SubcategoryAccordion from './SubcategoryAccordion';

const CategoryAccordion = ({ category, transactions = [], showPriorityExpenses, editMode, categories = [], onPriorityChange }) => {
  const [categoryName, setCategoryName] = useState(category.name);
  const [categoryLimit, setCategoryLimit] = useState(category.category_limit);
  const [categoryPriority, setCategoryPriority] = useState(category.priority_value);
  const [isEarmarked, setIsEarmarked] = useState(category.earmark);
  const [parentCategoryId, setParentCategoryId] = useState(category.parent_id);

  const handleNameChange = (e) => setCategoryName(e.target.value);
  const handleLimitChange = (e) => setCategoryLimit(e.target.value);
  const handlePriorityChange = (e) => {
    const newPriorityValue = parseInt(e.target.value, 10);
    setCategoryPriority(newPriorityValue);
    onPriorityChange(category.id, newPriorityValue);
  };
  const handleEarmarkChange = () => setIsEarmarked(!isEarmarked);
  const handleParentCategoryChange = (e) => setParentCategoryId(e.target.value);

  const saveCategoryChanges = async () => {
    try {
      await axios.put(`/categories/${category.id}`, {
        name: categoryName,
        category_limit: categoryLimit,
        priority_value: categoryPriority,
        earmark: isEarmarked,
        parent_id: parentCategoryId,
      });
      // Optionally, refresh the data or show a success message
    } catch (error) {
      console.error('Error saving category changes:', error);
    }
  };

  useEffect(() => {
    console.log('Subcategories:', category.subcategories);
    console.log('Transactions for category:', transactions);
  }, [category.subcategories, transactions]);

  // Filter transactions for this specific category
  const categoryTransactions = transactions.filter(
    (transaction) => transaction.category_id === category.id
  );

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">
          {category.name}
        </Typography>
        <Tooltip title={`Total: ${category.total}, Earmark: ${category.earmark}, Limit: ${category.category_limit}, Priority Expenses: ${category.priority_expenses}`}>
          <Typography variant="body2" color="text.secondary" style={{ marginLeft: '1rem' }}>
            Total: ${category.total}, Limit: ${category.category_limit}, Priority: {category.priority_value}
          </Typography>
        </Tooltip>
      </AccordionSummary>
      <AccordionDetails>
        {editMode ? (
          <div>
            <TextField label="Category Name" value={categoryName} onChange={handleNameChange} />
            <TextField label="Category Limit" type="number" value={categoryLimit} onChange={handleLimitChange} />
            <TextField label="Priority Value" type="number" value={categoryPriority} onChange={handlePriorityChange} />
            <FormControlLabel
              control={<Switch checked={isEarmarked} onChange={handleEarmarkChange} />}
              label="Earmarked"
            />
            <Select
              label="Parent Category"
              value={parentCategoryId || ''}
              onChange={handleParentCategoryChange}
            >
              <MenuItem value={null}>None</MenuItem>
              {categories.filter(cat => cat.id !== category.id).map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
            <Button variant="contained" color="primary" onClick={saveCategoryChanges}>
              Save
            </Button>
          </div>
        ) : null}
        {categoryTransactions.length > 0 ? (
          categoryTransactions.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} categories={categories} editMode={editMode} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No transactions for this category.
          </Typography>
        )}
        {category.subcategories && category.subcategories.length > 0 && (
          <div style={{ marginLeft: '1rem' }}>
            {category.subcategories.map((subcategory) => {
              // Filter transactions for this specific subcategory
              const subcategoryTransactions = transactions.filter(
                (transaction) => transaction.category_id === subcategory.id
              );

              console.log(`Subcategory: ${subcategory.name}, Transactions:`, subcategoryTransactions);

              return (
                <SubcategoryAccordion
                  key={subcategory.id}
                  subcategory={subcategory}
                  transactions={subcategoryTransactions}
                  editMode={editMode}
                  categories={categories}
                  onPriorityChange={onPriorityChange}
                />
              );
            })}
          </div>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default CategoryAccordion;