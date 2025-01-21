import logo from './logo.svg';
import './App.css';
import BudgetTracker from './components/BudgetTracker';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div>
          <BudgetTracker />
        </div>
      </header>
    </div>
  );
}

export default App;
