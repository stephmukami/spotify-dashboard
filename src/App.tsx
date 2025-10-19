
import './App.css'
import { BrowserRouter as Router, Route,Routes } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';

function App() {



  return (
      <Router>

 <Routes>
      <Route path="/home"
        element={
          <Home />
        }
      />

         <Route path="/"
        element={
          <Login />
        }
      />

    
</Routes>
    </Router>
 



  )
}

export default App
