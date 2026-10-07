export const themeBootScript = `(function(){try{var key='kairos-theme';var stored=localStorage.getItem(key);var theme=stored==='light'||stored==='dark'?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',theme);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export const THEME_STORAGE_KEY = 'kairos-theme';
