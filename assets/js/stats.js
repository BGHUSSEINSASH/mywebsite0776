/* stats.js — the public stats page's one behaviour.
   tally.js already does the counting: it posts to the site's own edge
   function and, on success, marks #tally live and paints the three
   numbers. this file does not fetch anything and does not count a second
   time — it only decides what the page shows while the box is still dark.

   if the grid never goes live (no project url configured, or the backend
   answered badly), the honest thing is to say so rather than leave three
   zeros or an empty gap. so after tally.js has had its turn, if the grid
   is still not live, the offline note is revealed instead. */

(function (doc, win) {
  'use strict';

  var WAIT_MS = 2600;   // tally.js resolves on a fetch; give it room

  function decide() {
    var grid = doc.getElementById('tally');
    var note = doc.getElementById('statsOffline');
    if (!note) return;
    var live = grid && grid.classList.contains('live') && grid.hidden === false;
    note.hidden = live;         // show the note only when the grid stayed dark
    if (grid && !live) grid.hidden = true;
  }

  function start() {
    // check once soon and once more after the wait, so a slow backend that
    // lands between the two still hides the note
    setTimeout(decide, 400);
    setTimeout(decide, WAIT_MS);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(document, window);
