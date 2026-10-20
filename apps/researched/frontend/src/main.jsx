import {readTheme} from './theme.js';
document.documentElement.dataset.theme = readTheme();
if(new URLSearchParams(location.search).has('responsibilities'))await import('./responsibilities/Responsibilities.jsx');
else if(new URLSearchParams(location.search).has('expert'))await import('./content-ui.jsx');
else await import('./workbench/Workbench.jsx');
