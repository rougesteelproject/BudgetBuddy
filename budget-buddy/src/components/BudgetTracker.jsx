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
  const [categoryUpdates, setCategoryUpdates] = useState([]);

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
        const { categories, transactions } = response.data;
        setCategories(categories);
        setTransactions(transactions);
        console.log('Fetched categories:', categories);
        console.log('Fetched transactions:', transactions);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const groupCategories = (categories, transactions = []) => {
    const grouped = categories.reduce((acc, category) => {
      const categoryTransactions = transactions.filter(
        transaction => transaction.category_id === category.id
      );

      if (category.parent_id) {
        if (!acc[category.parent_id]) {
          acc[category.parent_id] = { ...acc[category.parent_id], subcategories: [] };
        }
        acc[category.parent_id].subcategories.push({ ...category, transactions: categoryTransactions });
      } else {
        acc[category.id] = {
          ...category,
          transactions: categoryTransactions,
          subcategories: acc[category.id]?.subcategories || [],
        };
      }
      return acc;
    }, {});

    return Object.values(grouped).map(category => ({
      ...category,
      subcategories: category.subcategories || [],
    }));
  };

  const calculateTotals = (categories, transactions) => {
    return categories.map(category => {
      const categoryTransactions = transactions.filter(
        transaction => transaction.category_id === category.id
      );
      const subcategories = category.subcategories.map(subcategory => {
        const subcategoryTransactions = transactions.filter(
          transaction => transaction.category_id === subcategory.id
        );
        const subcategoryTotal = subcategoryTransactions.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        );
        return { ...subcategory, total: subcategoryTotal };
      });

      const categoryTotal = categoryTransactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
      );

      // Sum subcategory totals into the main category total
      const total = subcategories.reduce(
        (sum, subcategory) => sum + subcategory.total,
        categoryTotal
      );

      return { ...category, total, subcategories };
    });
  };

  const groupedCategories = calculateTotals(groupCategories(categories, transactions), transactions);

  const calculateGrandTotals = (categories) => {
    let grandTotal = 0;
    let grandTotalLimit = 0;

    categories.forEach(category => {
      grandTotal += category.total;
      grandTotalLimit += category.category_limit;
      category.subcategories.forEach(subcategory => {
        grandTotal += subcategory.total;
        grandTotalLimit += subcategory.category_limit;
      });
    });

    return { grandTotal, grandTotalLimit };
  };

  const { grandTotal, grandTotalLimit } = calculateGrandTotals(groupedCategories);

  const handleCreateCategory = async () => {
    try {
      const maxPriorityValue = Math.max(...categories.map(category => category.priority_value), 0);
      await axios.post('/categories/new', { name: newCategoryName, user_id: process.env.REACT_APP_USER_ID, priority_value: maxPriorityValue + 1 });
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

  const handlePriorityChange = (categoryId, newPriorityValue) => {
    const updatedCategories = categories.map(category => {
      if (category.id === categoryId) {
        return { ...category, priority_value: newPriorityValue };
      } else if (category.priority_value >= newPriorityValue) {
        return { ...category, priority_value: category.priority_value + 1 };
      }
      return category;
    });

    setCategories(updatedCategories);
    setCategoryUpdates(updatedCategories);
  };

  const handleSaveChanges = async () => {
    try {
      await Promise.all(categoryUpdates.map(category => axios.put(`/categories/${category.id}`, category)));
      setCategoryUpdates([]);
      setEditMode(false);
      // Refresh categories
      const response = await axios.get('/api/transactions', {
        params: { user_id: process.env.REACT_APP_USER_ID },
      });
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error saving category changes:', error);
    }
  };

  return (
    <div>
      <div style={{ padding: '1rem' }}>
        <Typography variant="h4" gutterBottom>
          Budget Tracker
        </Typography>

        <Typography variant="h6">
          Grand Total: ${grandTotal}, Grand Total Limit: ${grandTotalLimit}
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
            <Button variant="contained" color="primary" onClick={handleSaveChanges}>
              Save All Changes
            </Button>
          </div>
        )}

        {groupedCategories.length > 0 ? (
          groupedCategories.map((category) => (
            <CategoryAccordion
              key={category.id}
              category={category}
              transactions={transactions}
              showPriorityExpenses={showPriorityExpenses}
              editMode={editMode}
              categories={categories}
              onPriorityChange={handlePriorityChange}
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