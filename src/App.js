import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ViewMVL from './components/ViewMVL';
import ObjectPage from './components/ObjectPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Route for ViewMVL */}
        <Route path="/" element={<ViewMVL />} />
        {/* Route for ObjectPage */}
        <Route path="/object" element={<ObjectPage />} />
      </Routes>
    </Router>
  );
}

export default App;
