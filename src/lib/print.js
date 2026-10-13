// ============================================================
// Print: HTML ko nayi window/tab mein kholkar print karta hai.
// (Pehle chhupe hue iframe se print hota tha — Android phone par wahan se
// poora page hi print/blank ho jata tha.) Window khul na paye (popup block)
// to purane iframe tareeke par laut jata hai.
// ============================================================
export function printHtml(html) {
  const script = "<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},400);});<\/script>";
  let w = null;
  try { w = window.open("", "_blank"); } catch { w = null; }
  if (w && w.document) {
    w.document.open();
    w.document.write(html.replace("</body>", script + "</body>"));
    w.document.close();
    return true;
  }
  // Fallback: chhupa iframe
  try {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const d = iframe.contentWindow.document;
    d.open(); d.write(html); d.close();
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* ignore */ }
      setTimeout(() => iframe.remove(), 3000);
    }, 600);
    return true;
  } catch { return false; }
}
