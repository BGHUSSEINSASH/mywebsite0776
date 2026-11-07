/* the theme is decided before the first paint, so this file sits in the
   head and stays tiny: no helpers, no imports, nothing to wait for.
   it used to be inline in every page — out of the page means the
   content-security-policy can drop 'unsafe-inline' for scripts. */
(function () {
  'use strict';
  try {
    var st = localStorage.getItem('theme');
    document.documentElement.dataset.theme = st ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
