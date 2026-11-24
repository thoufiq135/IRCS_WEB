import { useState } from 'react'
import { BrowserRouter,Routes,Route } from 'react-router-dom'
import './App.css'
import Login from './login'
import Dashboard from './dashboard'

function App() {
  const [count, setCount] = useState(0)

  return (
 <BrowserRouter>
 <Routes>
  <Route path='/login' element={<Login/>}/>
    <Route path='/dashboard' element={<Dashboard/>}/>
 </Routes>
 </BrowserRouter>
  )
}

export default App
