export const formatDate = (date, format = 'short') => {
  if (!date) return '';
  
  const d = new Date(date);
  const options = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    time: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    relative: 'auto',
  };

  if (format === 'relative') {
    const now = new Date();
    const diffMs = now - d;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString('en-US', options.short);
  }

  return d.toLocaleDateString('en-US', options[format] || options.short);
};

export const formatTime = (date) => {
  return formatDate(date, 'time');
};

export const formatRelative = (date) => {
  return formatDate(date, 'relative');
};