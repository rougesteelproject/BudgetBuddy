import { useEffect, useState } from 'react';
import axios from 'axios';
import CategoryAccordion from './CategoryAccordion';
import { Typography, Switch, FormControlLabel, Button, TextField, Select, MenuItem, Modal, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const BudgetTracker = () => {
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showPriorityExpenses, setShowPriorityExpenses] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [includeEarmarked, setIncludeEarmarked] = useState(false);
  const [simulationResult, setSimulationResult] = useState('');

  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/plaid');
  };

  const togglePriorityExpenses = () => {
    setShowPriorityExpenses(!showPriorityExpenses);
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const openSimulationModal = () => {
    setSimulationModalOpen(true);
  };

  const closeSimulationModal = () => {
    setSimulationModalOpen(false);
    setSimulationResult('');
  };

  const handleSimulate = async () => {
    try {
      const response = await axios.post('/simulate-priority-expenses', {
        category_id: selectedCategory,
        amount: parseFloat(amount),
        include_earmarked: includeEarmarked,
      });
      setSimulationResult(response.data.message);
    } catch (error) {
      console.error('Error simulating priority expenses:', error);
      setSimulationResult('Error simulating priority expenses.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/transactions', {
          params: { user_id: process.env.REACT_APP_USER_ID },
        });

        if (response.data) {
          const { categories: fetchedCategories, transactions: fetchedTransactions } = response.data;

          // Assign priority values to categories without one
          const updatedCategories = fetchedCategories.map((category, index) => {
            if (category.priority_value === null || category.priority_value === undefined) {
              category.priority_value = index + 1; // Assign a priority value
              // Save the updated priority value to the database
              axios.put(`/categories/${category.id}`, { priority_value: category.priority_value });
            }
            return category;
          });

          setCategories(Array.isArray(updatedCategories) ? updatedCategories : []);
          setTransactions(Array.isArray(fetchedTransactions) ? fetchedTransactions : []);
        }
      } catch (error) {
        console.error('Client Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const groupCategories = (categories) => {
    const grouped = categories.reduce((acc, category) => {
      if (category.parent_id) {
        if (!acc[category.parent_id]) {
          acc[category.parent_id] = { subcategories: [] };
        }
        acc[category.parent_id].subcategories.push(category);
      } else {
        acc[category.id] = { ...category, subcategories: acc[category.id]?.subcategories || [] };
      }
      return acc;
    }, {});

    return Object.values(grouped);
  };

  const groupedCategories = groupCategories(categories);

  const handleCreateCategory = async () => {
    try {
      await axios.post('/categories', { name: newCategoryName, user_id: process.env.REACT_APP_USER_ID });
      setNewCategoryName('');
      // Refresh categories
      const response = await axios.get('/api/transactions', {
        params: { user_id: process.env.REACT_APP_USER_ID },
      });
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  return (
    <div>
      <div style={{ padding: '1rem' }}>
        <Typography variant="h4" gutterBottom>
          Budget Tracker
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={showPriorityExpenses}
              onChange={togglePriorityExpenses}
              color="primary"
            />
          }
          label={showPriorityExpenses ? 'Hide Priority Expenses' : 'Show Priority Expenses'}
        />

        <FormControlLabel
          control={
            <Switch
              checked={editMode}
              onChange={toggleEditMode}
              color="secondary"
            />
          }
          label={editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        />

        {editMode && (
          <div>
            <TextField
              label="New Category Name"
              value={newCategoryName || ''}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <Button variant="contained" color="primary" onClick={handleCreateCategory}>
              Create Category
            </Button>
          </div>
        )}

        {groupedCategories.length > 0 ? (
          groupedCategories.map((category) => (
            <CategoryAccordion
              key={category.id}
              category={category}
              transactions={transactions.filter(
                (transaction) => transaction.category_id === category.id
              )}
              showPriorityExpenses={showPriorityExpenses}
              editMode={editMode}
              categories={categories}
            />
          ))
        ) : (
          <Typography variant="body1">No categories available.</Typography>
        )}
      </div>
      <div>
        <button onClick={handleClick}>Manage Plaid Tokens</button>
      </div>
      <Button
        variant="contained"
        color="primary"
        style={{ position: 'fixed', bottom: '20px', right: '20px' }}
        onClick={openSimulationModal}
      >
        Simulate Priority Expenses
      </Button>
      <Modal open={simulationModalOpen} onClose={closeSimulationModal}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Simulate Priority Expenses
          </Typography>
          <Select
            fullWidth
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value)}
            displayEmpty
          >
            <MenuItem value="" disabled>
              Select Category
            </MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(e.target.value)}
            margin="normal"
          />
          <FormControlLabel
            control={
              <Switch
                checked={includeEarmarked}
                onChange={() => setIncludeEarmarked(!includeEarmarked)}
                color="primary"
              />
            }
            label="Include Earmarked Categories"
          />
          <Button variant="contained" color="primary" onClick={handleSimulate}>
            Simulate
          </Button>
          {simulationResult && (
            <Typography variant="body2" color="text.secondary" style={{ marginTop: '1rem' }}>
              {simulationResult}
            </Typography>
          )}
        </Box>
      </Modal>
    </div>
  );
};

export default BudgetTracker;