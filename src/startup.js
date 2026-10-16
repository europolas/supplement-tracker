/** Apply public display preferences before first paint; never read account data. */
try {
 const saved=JSON.parse(localStorage.getItem('supplement-tracker:settings')||'null')?.value;
 const theme=['light','dark','system'].includes(saved?.theme)?saved.theme:'light';
 document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;
 document.documentElement.style.colorScheme=document.documentElement.dataset.theme;
 if(saved?.language==='lt')document.documentElement.lang='lt';
} catch { /* Unavailable storage retains the English/light defaults. */ }
