import React from 'react';
import { createBrowserRouter, Route } from 'react-router-dom';
// RULE: react/no-sync-route-import
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

export const router = createBrowserRouter([
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/profile', element: <Profile /> },
]);
