import logo from './logo.svg';
import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import BudgetTracker from './components/BudgetTracker';
import PlaidPage from './components/PlaidPage';
import { useEffect } from 'react';

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/budget" element={<BudgetTracker/>} />
        <Route path="/plaid" element={<PlaidPage/>} />
      </Routes>
    </Router>
  );
}

export default App;
