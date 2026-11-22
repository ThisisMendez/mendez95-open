import React from 'react';
import {ManagedWindowsProvider} from './desktop/ManagedWindows';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import {PocketPreferencesProvider} from './pocket/preferences';
import './pocket/pocket.css';
import './styles/tokens.css';
import './styles/system.css';
import './styles/app.css';
import './styles/desktopReadability.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><PocketPreferencesProvider><ManagedWindowsProvider><App /></ManagedWindowsProvider></PocketPreferencesProvider></React.StrictMode>);
