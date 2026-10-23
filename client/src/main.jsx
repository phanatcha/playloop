import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource-variable/kode-mono';
import '@fontsource/palette-mosaic/latin-400.css';
import './styles/global.css';
import { router } from './routes.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
