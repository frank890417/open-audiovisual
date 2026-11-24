// The Copy buttons of the device pages: the code of the <pre> a button names, to the clipboard. assets/track.js counts the
// click (oav_copy) on its own; this file only copies and says so.
export function wireCopy({ copy = 'Copy', copied = 'Copied' } = {}) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.copy[data-copy]');
    if (!b) return;
    const pre = document.getElementById(b.dataset.copy);
    if (!pre || !navigator.clipboard) return;
    navigator.clipboard.writeText(pre.textContent).then(() => {
      b.textContent = copied; b.dataset.done = '';
      setTimeout(() => { b.textContent = copy; delete b.dataset.done; }, 1400);
    }, () => {});
  });
}
