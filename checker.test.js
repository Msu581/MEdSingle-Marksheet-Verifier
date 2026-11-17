// Tests for the core logic of grade_sheet_checker.html
// Run: node checker.test.js [path/to/grade_sheet_checker.html]
const fs = require('fs');
const assert = require('assert');
const file = process.argv[2] || __dirname + '/grade_sheet_checker.html';
const html = fs.readFileSync(file, 'utf8');
const s = html.indexOf('/*CORE-START*/'), e = html.indexOf('/*CORE-END*/');
assert(s > 0 && e > s, 'CORE block not found in html');
const core = new Function(html.slice(s, e) +
  '\nreturn {Rat,SCALES,gradeFor,parseSheets,checkSheet};')();
const { SCALES, gradeFor, parseSheets, checkSheet, Rat } = core;

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok   ' + name); }
  catch (x) { fail++; console.log('  FAIL ' + name + '\n       ' + x.message); } };
const R = x => Rat.parse(String(x));

const sheetText = ({ name = 'Test Student', reg = '22071020039038', rows, total, footer }) =>
  `GRADE SHEET Name of Student : ${name} Father's Name : F Mother's Name : M Date of Birth : 01-01-2005 ` +
  `Aadhaar No. : XXXXXXXX2442 ABC ID : 1 SCHOOL OF DESIGN Category : Regular Programme : Bachelor of Vocation ` +
  `Specialization : Fashion Design Registration No. : ${reg} Semester : Fifth Semester Year Of Admission : 2024-2025 ` +
  `Course Code Course Name Credits (T-P-PR) Marks Grade Grade Points Credit Points ${rows.join(' ')} Total ${total} ${footer} Date :24/07/2025`;

// correct sheet, OLD scale
const OLD_ROWS = ['AAA101 Subject One 3-0-0 85 A 8 24', 'AAB102 Subject Two 0-4-0 92 A+ 9 36',
  'AAC103 Long Name That Wraps Over 2-0-0 55 C 5 10'];
const OLD_TOTAL = '5-4-0 232 70';
const OLD_FOOT = 'Maximum Marks: 300 Percentage of Marks: 77.3 Total Credits: 9 Grand Total Credit Points: 90 SGPA: 7.8';
// correct sheet, NEW scale
const NEW_ROWS = ['AAA101 Subject One 3-0-0 85 A+ 9 27', 'AAB102 Subject Two 0-4-0 92 O 10 40',
  'AAC103 Long Name That Wraps Over 2-0-0 55 B 6 12'];
const NEW_TOTAL = '5-4-0 232 79';
const NEW_FOOT = 'Maximum Marks: 300 Percentage of Marks: 77.3 Total Credits: 9 Grand Total Credit Points: 90 SGPA: 8.8';

const issuesOf = r => r.issues.map(i => `${i.ref}|${i.field}|${i.printed}|${i.expected}`);

console.log('Grade scales');
t('OLD: 99->O, 98->A+, 90->A+, 89->A, 80->A, 79->B+, 70->B+, 69->B, 60->B, 59->C, 50->C, 49->P, 40->P, 39->F',
  () => { const exp = { 99: 'O', 100: 'O', 98: 'A+', 90: 'A+', 89: 'A', 80: 'A', 79: 'B+', 70: 'B+', 69: 'B', 60: 'B', 59: 'C', 50: 'C', 49: 'P', 40: 'P', 39: 'F', 0: 'F' };
    for (const [m, g] of Object.entries(exp)) assert.strictEqual(gradeFor(R(m), 'old').g, g, `old ${m}`); });
t('NEW: 100->O, 90->O, 89->A+, 80->A+, 79->A, 70->A, 69->B+, 60->B+, 59->B, 50->B, 49->C, 45->C, 44->P, 40->P, 39->F',
  () => { const exp = { 100: 'O', 90: 'O', 89: 'A+', 80: 'A+', 79: 'A', 70: 'A', 69: 'B+', 60: 'B+', 59: 'B', 50: 'B', 49: 'C', 45: 'C', 44: 'P', 40: 'P', 39: 'F' };
    for (const [m, g] of Object.entries(exp)) assert.strictEqual(gradeFor(R(m), 'new').g, g, `new ${m}`); });
t('grade points: O10 A+9 A8 B+7 B6 C5 P4 F0', () => {
  const pts = {}; SCALES.old.forEach(r => pts[r[0]] = r[1]);
  assert.deepStrictEqual(pts, { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 }); });

console.log('Parsing');
const real = fs.readFileSync(__dirname + '/fixtures/tanshi.txt', 'utf8');
t('real PDF text: one sheet with header fields', () => {
  const sh = parseSheets(real); assert.strictEqual(sh.length, 1);
  const h = sh[0].header;
  assert.strictEqual(h.name, 'Tanshi Agarwal'); assert.strictEqual(h.reg, '22071020039038');
  assert.strictEqual(h.programme, 'Bachelor of Vocation'); assert.strictEqual(h.specialization, 'Fashion Design');
  assert.strictEqual(h.semester, 'Fifth Semester'); assert.strictEqual(h.year, '2024-2025'); });
t('real PDF text: 7 subject rows incl. total/footer', () => {
  const sh = parseSheets(real)[0];
  assert.strictEqual(sh.rows.length, 7);
  assert.deepStrictEqual(sh.rows.map(r => r.code), ['FDL301', 'FDL300', 'FDP302', 'FDP300', 'IDP301', 'MTL200', 'AML202']);
  const r2 = sh.rows[2]; assert.strictEqual(r2.name, 'Design Studio: Haute Couture');
  assert.deepStrictEqual([r2.tpp, r2.marks, r2.grade, r2.gp, r2.cp], ['0-4-0', '48', 'F', '0', '0']);
  assert.deepStrictEqual(sh.total, { tpp: '10-12-0', marks: '417', cp: '102' });
  assert.deepStrictEqual(sh.footer, { maxMarks: '700', percentage: '59.6', totalCredits: '22', grandCP: '220', sgpa: '5.2' });
  assert.deepStrictEqual(sh.warnings, []); });
t('pdf.js two-column layout (header fields + column headings interleaved) is parsed', () => {
  const txt = fs.readFileSync(__dirname + '/fixtures/tanshi_pdfjs.txt', 'utf8');
  const sh = parseSheets(txt)[0]; assert.strictEqual(sh.rows.length, 7);
  assert.deepStrictEqual(sh.warnings, []);
  assert.deepStrictEqual([sh.header.name, sh.header.reg, sh.header.programme, sh.header.specialization, sh.header.semester, sh.header.year, sh.header.category],
    ['Tanshi Agarwal', '22071020039038', 'Bachelor of Vocation', 'Fashion Design', 'Fifth Semester', '2024-2025', 'Regular']);
  const r = checkSheet(sh, 'auto'); assert.strictEqual(r.issues.length, 4); assert.strictEqual(r.status, 'MISMATCH'); });
t('wrapped course name (name continues on next line) is parsed', () => {
  const txt = sheetText({ rows: ['AAA101 Pattern Grading and Garment Construction\nfor Men 0-4-0 85 A 8 32'], total: '0-4-0 85 32',
    footer: 'Maximum Marks: 100 Percentage of Marks: 85 Total Credits: 4 Grand Total Credit Points: 40 SGPA: 8' });
  const sh = parseSheets(txt)[0]; assert.strictEqual(sh.rows.length, 1);
  assert.strictEqual(sh.rows[0].name, 'Pattern Grading and Garment Construction for Men'); });
t('wrapped name part printed AFTER the numbers is appended to the name', () => {
  const txt = sheetText({ rows: ['AAA101 Pattern Grading and Garment Construction 0-4-0 85 A 8 32 for Men', 'AAB102 Other 2-0-0 90 A+ 9 18'], total: '2-4-0 175 50',
    footer: 'Maximum Marks: 200 Percentage of Marks: 87.5 Total Credits: 6 Grand Total Credit Points: 60 SGPA: 8.3' });
  const sh = parseSheets(txt)[0]; assert.strictEqual(sh.rows.length, 2);
  assert.strictEqual(sh.rows[0].name, 'Pattern Grading and Garment Construction for Men'); });
t('two grade sheets in one PDF -> two sheets', () => {
  const a = sheetText({ name: 'A One', rows: OLD_ROWS, total: OLD_TOTAL, footer: OLD_FOOT });
  const b = sheetText({ name: 'B Two', rows: NEW_ROWS, total: NEW_TOTAL, footer: NEW_FOOT });
  const sh = parseSheets(a + '\n' + b); assert.strictEqual(sh.length, 2);
  assert.deepStrictEqual(sh.map(x => x.header.name), ['A One', 'B Two']); });
t('text with no grade sheet -> no sheets', () => assert.deepStrictEqual(parseSheets('hello world'), []));
t('missing rows -> warning', () => {
  const sh = parseSheets(sheetText({ rows: [], total: '0-0-0 0 0', footer: OLD_FOOT }))[0];
  assert.ok(sh.warnings.length > 0); });

console.log('Checking: correct sheets');
t('correct OLD sheet: no issues, scale old (auto)', () => {
  const r = checkSheet(parseSheets(sheetText({ rows: OLD_ROWS, total: OLD_TOTAL, footer: OLD_FOOT }))[0], 'auto');
  assert.deepStrictEqual(issuesOf(r), []); assert.strictEqual(r.scale, 'old'); assert.strictEqual(r.status, 'OK'); });
t('correct NEW sheet: no issues, scale new (auto)', () => {
  const r = checkSheet(parseSheets(sheetText({ rows: NEW_ROWS, total: NEW_TOTAL, footer: NEW_FOOT }))[0], 'auto');
  assert.deepStrictEqual(issuesOf(r), []); assert.strictEqual(r.scale, 'new'); assert.strictEqual(r.status, 'OK'); });
t('NEW sheet checked with forced OLD scale -> grade mismatches', () => {
  const r = checkSheet(parseSheets(sheetText({ rows: NEW_ROWS, total: NEW_TOTAL, footer: NEW_FOOT }))[0], 'old');
  assert.ok(r.issues.some(i => i.field === 'Grade')); assert.strictEqual(r.status, 'MISMATCH'); });

console.log('Checking: the real sample sheet (OLD scale, seeded errors)');
t('real sheet: exactly the expected issues', () => {
  const r = checkSheet(parseSheets(real)[0], 'auto');
  assert.strictEqual(r.scale, 'old'); assert.strictEqual(r.status, 'MISMATCH');
  assert.deepStrictEqual(issuesOf(r).sort(), [
    'FDP300|Credit Points|16|12',
    'FDP302|Credit Points|0|16',
    'FDP302|Grade Points|0|4',
    'FDP302|Grade|F|P',
  ].sort()); });
t('real sheet: Total Credit Points 102 = sum of the printed Credit Points column -> OK', () => {
  const r = checkSheet(parseSheets(real)[0], 'auto');
  const cp = r.totals.find(x => x.key === 'cp'); assert.strictEqual(cp.ok, true); assert.strictEqual(cp.expected, '102'); });
t('real sheet: SGPA expected comes from marks-derived credit points (114 / 22 = 5.2)', () => {
  const r = checkSheet(parseSheets(real)[0], 'auto');
  const sg = r.totals.find(x => x.key === 'sgpa'); assert.strictEqual(sg.expected, '5.2'); assert.ok(/114/.test(sg.note)); });
t('real sheet: correct totals are reported OK', () => {
  const r = checkSheet(parseSheets(real)[0], 'auto');
  const ok = Object.fromEntries(r.totals.map(x => [x.key, x.ok]));
  assert.deepStrictEqual(ok, { tpp: true, credits: true, marks: true, cp: true, max: true, pct: true, grand: true, sgpa: true }); });
t('real sheet: per-row flags', () => {
  const r = checkSheet(parseSheets(real)[0], 'auto');
  const row = c => r.rows.find(x => x.code === c);
  assert.deepStrictEqual([row('FDP302').gradeOK, row('FDP302').gpOK, row('FDP302').cpOK], [false, false, false]);
  assert.deepStrictEqual([row('FDP300').gradeOK, row('FDP300').gpOK, row('FDP300').cpOK], [true, true, false]);
  assert.strictEqual(row('FDP302').expGrade, 'P'); assert.strictEqual(row('FDP302').expCP, '16'); });

console.log('Checking: each field is individually detected');
const base = (over = {}) => {
  const rows = over.rows || OLD_ROWS;
  return checkSheet(parseSheets(sheetText({ rows, total: over.total || OLD_TOTAL, footer: over.footer || OLD_FOOT }))[0], 'old'); };
t('wrong grade for marks', () => assert.ok(issuesOf(base({ rows: ['AAA101 Subject One 3-0-0 85 A+ 8 24', OLD_ROWS[1], OLD_ROWS[2]] })).includes('AAA101|Grade|A+|A')));
t('wrong grade points for marks', () => assert.ok(issuesOf(base({ rows: ['AAA101 Subject One 3-0-0 85 A 9 24', OLD_ROWS[1], OLD_ROWS[2]] })).includes('AAA101|Grade Points|9|8')));
t('wrong credit points (credit x GP)', () => assert.ok(issuesOf(base({ rows: ['AAA101 Subject One 3-0-0 85 A 8 25', OLD_ROWS[1], OLD_ROWS[2]] })).includes('AAA101|Credit Points|25|24')));
t('wrong total credits', () => assert.ok(issuesOf(base({ footer: OLD_FOOT.replace('Total Credits: 9', 'Total Credits: 10') })).includes('Totals|Total Credits|10|9')));
t('wrong total marks', () => assert.ok(issuesOf(base({ total: '5-4-0 233 70' })).includes('Totals|Total Marks|233|232')));
t('wrong total credit points (must equal sum of the column)', () => assert.ok(issuesOf(base({ total: '5-4-0 232 71' })).includes('Totals|Total Credit Points|71|70')));
t('wrong total T-P-PR', () => assert.ok(issuesOf(base({ total: '6-4-0 232 70' })).includes('Totals|Total T-P-PR|6-4-0|5-4-0')));
t('wrong maximum marks', () => assert.ok(issuesOf(base({ footer: OLD_FOOT.replace('Maximum Marks: 300', 'Maximum Marks: 400') })).includes('Totals|Maximum Marks|400|300')));
t('wrong percentage', () => assert.ok(issuesOf(base({ footer: OLD_FOOT.replace('77.3', '77.4') })).includes('Totals|Percentage of Marks|77.4|77.3')));
t('wrong grand total credit points', () => assert.ok(issuesOf(base({ footer: OLD_FOOT.replace('Points: 90', 'Points: 100') })).includes('Totals|Grand Total Credit Points|100|90')));
t('wrong SGPA', () => assert.ok(issuesOf(base({ footer: OLD_FOOT.replace('SGPA: 7.8', 'SGPA: 7.9') })).includes('Totals|SGPA|7.9|7.8')));
t('SGPA rounded HALF_UP to printed decimals (exact 7.777.. -> 7.8, 2dp -> 7.78)', () => {
  assert.ok(!issuesOf(base({ footer: OLD_FOOT.replace('SGPA: 7.8', 'SGPA: 7.78') })).some(x => x.startsWith('Totals|SGPA')));
  assert.ok(issuesOf(base({ footer: OLD_FOOT.replace('SGPA: 7.8', 'SGPA: 7.77') })).some(x => x.startsWith('Totals|SGPA'))); });
t('percentage rounded HALF_UP (232/3 = 77.333)', () => assert.ok(!issuesOf(base()).some(x => x.startsWith('Totals|Percentage'))));
t('failed subject (marks<40) expects F / 0 / 0', () => {
  const rows = ['AAA101 Subject One 3-0-0 35 F 0 0'];
  const r = checkSheet(parseSheets(sheetText({ rows, total: '3-0-0 35 0',
    footer: 'Maximum Marks: 100 Percentage of Marks: 35 Total Credits: 3 Grand Total Credit Points: 30 SGPA: 0' }))[0], 'old');
  assert.deepStrictEqual(issuesOf(r), []); assert.strictEqual(r.rows[0].isFail, true); });
t('credits per course = T+P+PR', () => {
  const r = base(); assert.deepStrictEqual(r.rows.map(x => x.credits), ['3', '4', '2']); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
