import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/fonts';
import './styles/app.css';
import './styles/themes.css';
import './store/theme';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
