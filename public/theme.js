// Apply the saved appearance before the application paints, including in the
// iPhone standalone window. Keep the system option responsive in React too.
try {
 const saved = localStorage.getItem('ww.theme.v2');
 const selected = ['holiday', 'light', 'dark', 'system'].includes(saved) ? saved : 'holiday';
 const resolved = selected === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : selected;
 document.documentElement.dataset.theme = resolved;
 document.documentElement.dataset.cursor = localStorage.getItem('ww.cursor') === 'system' ? 'system' : 'custom';
 document.documentElement.dataset.motion = localStorage.getItem('ww.effects') === 'off' ? 'reduced' : 'full';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#17151d' : resolved === 'light' ? '#faf9f7' : '#160e19');
} catch {
 document.documentElement.dataset.theme = 'holiday';
}
