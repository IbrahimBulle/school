function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function printBrandedReport({ school = {}, title, subtitle = "", columns = [], rows = [], footer = "" }) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) throw new Error("Allow pop-ups to print or save this report as a PDF.");
  const logo = school.logo
    ? `<img class="logo" src="${escapeHtml(school.logo)}" alt="${escapeHtml(school.name || "School")} logo" />`
    : `<div class="logo-fallback">${escapeHtml((school.name || "S").slice(0, 1).toUpperCase())}</div>`;
  const contact = [school.location, school.contact].filter(Boolean).map(escapeHtml).join(" · ");
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#202a26;margin:0}.brand{display:flex;align-items:center;gap:16px;border-bottom:2px solid #234743;padding:0 0 16px;margin-bottom:22px}.logo,.logo-fallback{width:76px;height:76px;object-fit:contain}.logo-fallback{display:grid;place-items:center;background:#edf4ef;color:#234743;font-size:30px;font-weight:bold}.identity{flex:1}.identity h1{font-size:20px;margin:0 0 5px}.identity p{color:#62716a;margin:0;line-height:1.5}.report-title{margin:0 0 5px;font-size:18px}.subtitle{color:#64716c;margin:0 0 18px}.meta{color:#64716c;font-size:10px;margin:0 0 14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dce3df;padding:9px;text-align:left}th{background:#edf3ef;color:#29463b;font-size:10px;text-transform:uppercase}tr{break-inside:avoid}footer{border-top:1px solid #dce3df;margin-top:24px;padding-top:10px;color:#64716c;font-size:10px}.notice{margin-top:16px;color:#64716c;font-size:10px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><header class="brand">${logo}<div class="identity"><h1>${escapeHtml(school.name || "School")}</h1><p>${escapeHtml(school.level || "")}${school.level && contact ? " · " : ""}${contact}</p></div></header><main><h2 class="report-title">${escapeHtml(title)}</h2><p class="subtitle">${escapeHtml(subtitle)}</p><p class="meta">Generated ${escapeHtml(new Date().toLocaleString("en-KE"))}</p><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${tableRows || `<tr><td colspan="${Math.max(columns.length, 1)}">No records available.</td></tr>`}</tbody></table>${footer ? `<p class="notice">${escapeHtml(footer)}</p>` : ""}</main><footer>${escapeHtml(school.name || "School")} ${school.contact ? `· ${escapeHtml(school.contact)}` : ""}</footer><script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},300));</script></body></html>`);
  reportWindow.document.close();
}
