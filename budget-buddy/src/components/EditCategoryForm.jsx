import React, { useState } from 'react';
import { TextField, Button, Switch, FormControlLabel } from '@mui/material';
import axios from 'axios';

const EditCategoryForm = ({ category, onSave }) => {
  const [categoryName, setCategoryName] = useState(category.name);
  const [categoryLimit, setCategoryLimit] = useState(category.category_limit);
  const [categoryPriority, setCategoryPriority] = useState(category.priority_value);
  const [isEarmarked, setIsEarmarked] = useState(category.earmark);

  const handleNameChange = (e) => setCategoryName(e.target.value);
  const handleLimitChange = (e) => setCategoryLimit(e.target.value);
  const handlePriorityChange = (e) => setCategoryPriority(e.target.value);
  const handleEarmarkChange = () => setIsEarmarked(!isEarmarked);

  const saveCategoryChanges = async () => {
    try {
      await axios.put(`/categories/${category.id}`, {
        name: categoryName,
        category_limit: categoryLimit,
        priority_value: categoryPriority,
        earmark: isEarmarked,
      });
      onSave();
    } catch (error) {
      console.error('Error saving category changes:', error);
    }
  };

  return (
    <div>
      <TextField label="Category Name" value={categoryName} onChange={handleNameChange} />
      <TextField label="Category Limit" type="number" value={categoryLimit} onChange={handleLimitChange} />
      <TextField label="Priority Value" type="number" value={categoryPriority} onChange={handlePriorityChange} />
      <FormControlLabel
        control={<Switch checked={isEarmarked} onChange={handleEarmarkChange} />}
        label="Earmarked"
      />
      <Button variant="contained" color="primary" onClick={saveCategoryChanges}>
        Save
      </Button>
    </div>
  );
};

export default EditCategoryForm;