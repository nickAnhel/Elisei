import { createContext } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css'

import App from './App.jsx'
import Store from './store/store';
import { ThemeProvider } from './theme/ThemeProvider';


const store = new Store();
export const StoreContext = createContext({ store, });


createRoot(document.getElementById('root')).render(
  <StoreContext.Provider value={{ store }}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StoreContext.Provider>
)
