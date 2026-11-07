const fs = require('fs');
const src = fs.readFileSync('./electron/invoiceHtml.js', 'utf8');
const checks = [
  ['NO footer-left CSS', !src.includes('.footer-left')],
  ['NO footer-right CSS', !src.includes('.footer-right')],
  ['NO foot-cell-l1', !src.includes('foot-cell-l1')],
  ['NO cert-block CSS', !src.includes('.cert-block')],
  ['foot-cell-cert in CSS+HTML', src.includes('foot-cell-cert')],
  ['foot-cell-terms in CSS+HTML', src.includes('foot-cell-terms')],
  ['foot-cell-bank grid-row:1', src.includes('grid-row: 1;') || src.includes('grid-row:1')],
  ['45mm 30mm 25mm rows', src.includes('45mm 30mm 25mm')],
  ['product-body 78mm', src.includes('78mm')],
  ['footer-height 100mm', src.includes('100mm')],
  ['No signature-space in HTML', !src.includes('<div class="signature-space">')],
  ['Continuation exists', src.includes('continuation')],
  ['certContent in JS', src.includes('certContent')],
  ['termsSection in JS', src.includes('termsSection')],
  ['summaryContent in JS', src.includes('summaryContent')],
  ['grid-template-rows: 45mm 30mm 25mm', src.includes('grid-template-rows: 45mm 30mm 25mm')],
];
let pass = 0, fail = 0;
for (const [name, result] of checks) {
  console.log(result ? 'PASS' : 'FAIL', '-', name);
  if (result) pass++; else fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
