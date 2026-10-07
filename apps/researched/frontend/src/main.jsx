if(new URLSearchParams(location.search).has('expert'))await import('./content-ui.jsx');
else await import('./workbench/Workbench.jsx');
