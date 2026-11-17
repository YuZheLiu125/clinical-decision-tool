/* 臨床輔助決策工具 · 貼上解析（正本：shared/paste.js，由 scripts/sync_shared.py 寫進主訴處理、會診稿，不要直接改 HTML 裡這一段）
   把從 HIS、護理紀錄、LINE 貼來的一段文字拆成 vital sign 和檢驗值。
   pasteParse(text) → { v: {bt, sbp, dbp, pr, rr, spo2, sugar, gcs}, labs: [[id, 數值, 'H' | 'L' | '']] }
   不用 regex lookbehind（舊版 Safari 會整段 script 壞掉）。查房板有自己更完整的解析器（分血液／尿液、歷史報告），這裡只做當下這一筆。 */
const PASTE_LABS = [
  ['WBC', ['WBC'], 4, 10], ['Hb', ['Hb', 'HGB', 'Hgb', 'Hemoglobin'], 12, 17.5], ['Plt', ['Plt', 'PLT', 'Platelet'], 150, 400],
  ['Na', ['Na', 'Sodium'], 135, 145], ['K', ['K', 'Potassium'], 3.5, 5.0], ['Cl', ['Cl', 'Chloride'], 98, 107],
  ['HCO3', ['HCO3-', 'HCO3', 'Bicarbonate', 'TCO2'], 22, 26], ['BUN', ['BUN', 'Urea'], 7, 20], ['Cr', ['Creatinine', 'Crea', 'CRE', 'Cr'], 0.6, 1.3],
  ['eGFR', ['eGFR', 'GFR'], 60, null], ['Ca', ['Calcium', 'Ca'], 8.6, 10.4], ['Mg', ['Magnesium', 'Mg'], 1.7, 2.4], ['P', ['Phosphate', 'Phosphorus', 'IP', 'P'], 2.5, 4.5],
  ['Glu', ['Glucose AC', 'Glucose PC', 'Glucose', 'GLU-AC', 'Glu AC', 'Glu'], 70, 180],
  ['AST', ['AST', 'GOT'], null, 40], ['ALT', ['ALT', 'GPT'], null, 40], ['ALP', ['ALK-P', 'Alk-P', 'ALP'], 40, 130],
  ['T-bil', ['Total bilirubin', 'T-bil', 'T-Bil', 'T.Bil', 'TBIL', 'Bil-T'], null, 1.2], ['Alb', ['Albumin', 'Alb'], 3.5, 5.0],
  ['CRP', ['hs-CRP', 'CRP'], null, 0.5], ['PCT', ['Procalcitonin', 'PCT'], null, 0.5], ['Lactate', ['Lactic acid', 'Lactate', 'Lac'], null, 2.0],
  ['INR', ['PT-INR', 'INR'], 0.8, 1.2], ['aPTT', ['aPTT', 'APTT'], null, 40], ['D-dimer', ['D-dimer', 'D-Dimer'], null, 0.5],
  ['pH', ['pH'], 7.35, 7.45], ['PaCO2', ['PaCO2', 'pCO2', 'PCO2'], 35, 45], ['PaO2', ['PaO2', 'pO2', 'PO2'], 80, null],
  ['Troponin', ['hs-Troponin I', 'hs-Troponin T', 'Troponin-I', 'Troponin I', 'Troponin T', 'hs-TnI', 'hs-TnT', 'TnI', 'Troponin'], null, null],
  ['CK', ['CPK', 'CK'], null, 200], ['Lipase', ['Lipase'], null, 60], ['Ammonia', ['Ammonia', 'NH3'], null, 80],
  ['NT-proBNP', ['NT-proBNP', 'NT-pro BNP', 'NTproBNP'], null, 300], ['BNP', ['BNP'], null, 100],
].map(([id, al, lo, hi]) => ({ id, al, lo, hi }));
const PASTE_LAB = Object.fromEntries(PASTE_LABS.map(l => [l.id, l]));
const pasteFlag = (id, v) => { const l = PASTE_LAB[id]; return !l ? '' : l.lo != null && v < l.lo ? 'L' : l.hi != null && v > l.hi ? 'H' : ''; };
const PASTE_ALIASES = PASTE_LABS.flatMap(l => l.al.map(a => [a, l.id])).sort((a, b) => b[0].length - a[0].length);
const pasteEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* 合理範圍：超出就不當成這個項目 */
const PASTE_OK = { P: [0.1, 15], K: [1, 10], Na: [90, 200], Cl: [50, 150], pH: [6.5, 8], Ca: [2, 20], Mg: [0.2, 10], Hb: [1, 25], INR: [0.5, 20], Alb: [0.5, 7] };
const PASTE_NUM = '(-?\\d+(?:[.,]\\d+)?)';
const pasteN = s => parseFloat(String(s).replace(',', '.'));

function pasteVitals(text) {
  const src = ' ' + String(text).replace(/[：﹕]/g, ':').replace(/／/g, '/').replace(/％/g, '%').replace(/ |　/g, ' ') + ' ';
  const v = {}, used = [];
  // 名稱前面不能緊貼英文字母或數字；回傳數值並記下用掉的範圍，避免同一段被兩個項目抓到
  const grab = (names, lo, hi, tail) => {
    const re = new RegExp('(^|[^A-Za-z0-9])(?:' + names + ')\\s*[:=]?\\s*' + PASTE_NUM + (tail || ''), 'gi');
    let m;
    while ((m = re.exec(src))) {
      const x = pasteN(m[2]), s = m.index + m[1].length, e = m.index + m[0].length;
      if (x >= lo && x <= hi && !used.some(([a, b]) => s < b && e > a)) { used.push([s, e]); return x; }
    }
    return null;
  };
  const set = (k, x) => { if (x != null && v[k] == null) v[k] = String(x); };
  // TPR 36.8/88/18（護理紀錄常見的寫法）
  let m = /(^|[^A-Za-z])TPR\s*[:=]?\s*(\d{2}(?:[.,]\d)?)\s*\/\s*(\d{2,3})\s*\/\s*(\d{1,2})/i.exec(src);
  if (m) { set('bt', pasteN(m[2])); set('pr', +m[3]); set('rr', +m[4]); used.push([m.index, m.index + m[0].length]); }
  // 血壓：BP 92/58、血壓 92／58、NBP: 92/58 mmHg；沒有標名稱但長得像血壓的「120/80」也收
  m = /(^|[^A-Za-z0-9])(?:N?I?BP|ABP|血壓|blood pressure)\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i.exec(src) || /(^|[^0-9./])(\d{2,3})\s*\/\s*(\d{2,3})\s*mmHg/i.exec(src);
  if (m && +m[2] >= 40 && +m[2] <= 300 && +m[3] >= 20 && +m[3] <= 200) { set('sbp', +m[2]); set('dbp', +m[3]); used.push([m.index, m.index + m[0].length]); }
  set('sbp', grab('SBP|收縮壓', 40, 300)); set('dbp', grab('DBP|舒張壓', 20, 200));
  set('spo2', grab('SpO2|SPO2|SaO2|O2\\s*sat(?:uration)?|血氧(?:飽和度)?', 50, 100));
  set('bt', grab('BT|Temp(?:erature)?|體溫|耳溫|額溫|腋溫|肛溫', 30, 43));
  set('pr', grab('HR|PR|Pulse(?:\\s*rate)?|Heart\\s*rate|心跳|脈搏|心率', 20, 250));
  set('rr', grab('RR|Resp(?:iratory)?(?:\\s*rate)?|呼吸(?:次數|速率)?', 4, 70));
  set('sugar', grab('finger\\s*sugar|F\\/S|FS|one\\s*touch|sugar|血糖|BS', 20, 1500));
  // 單一字母的 T、P、R 只在後面有冒號或等號時才認（T:36.8 P:88 R:18）
  set('bt', grab('T\\s*[:=]', 30, 43)); set('pr', grab('P\\s*[:=]', 20, 250)); set('rr', grab('R\\s*[:=]', 4, 70));
  // GCS：E4V5M6、E4VTM6（插管）、GCS 15
  m = /E\s*([1-4])\s*,?\s*V\s*([1-5]|T|E|A)\s*,?\s*M\s*([1-6])/i.exec(src);
  if (m) v.gcs = `E${m[1]}V${m[2].toUpperCase()}M${m[3]}`;
  else { const g = grab('GCS', 3, 15); if (g != null) v.gcs = String(g); }
  return v;
}

function pasteLabs(text) {
  // 尿液段落不收（同名的 Na、K、Cr 會混在一起）：遇到尿液標題就跳過，直到下一個血液標題
  const lines = String(text).replace(/[：﹕]/g, ':').replace(/，/g, ', ').replace(/ |　/g, ' ').split(/\n/);
  let skip = false; const keep = [];
  lines.forEach(l => {
    if (/^\s*[【\[(（]?\s*(?:urine|urinalysis|u\/a|ua\b|尿液?|尿沉渣|sediment)/i.test(l)) skip = true;
    else if (/^\s*[【\[(（]?\s*(?:blood|serum|plasma|cbc|biochem|chemistry|生化|血液|血清|全血|abg|血液氣體)/i.test(l)) skip = false;
    if (!skip) keep.push(l);
  });
  const src = ' ' + keep.join('\n ') + ' ';
  // 長的別名先比對並佔位（NT-proBNP 先於 BNP）；同一項目有好幾個別名都出現時，取文字裡最前面的那一個
  const out = {}, at = {}, taken = [];
  for (const [a, id] of PASTE_ALIASES) {
    const re = new RegExp('(^|[^A-Za-z0-9-])' + pasteEsc(a) + '(?![A-Za-z0-9])[\\s:=*#<>]*(?:[(（][^)）\\n]{0,15}[)）])?[\\s:=*#<>]*(?:[\\u4e00-\\u9fff]{1,6}[\\s:=*#<>]*)?' + PASTE_NUM, a.length <= 2 ? 'g' : 'gi');
    let m;
    while ((m = re.exec(src))) {
      const s = m.index + m[1].length, e = s + a.length;
      if (taken.some(([x, y]) => s < y && e > x)) continue;
      const x = pasteN(m[2]), lim = PASTE_OK[id];
      if (isNaN(x) || (lim && (x < lim[0] || x > lim[1]))) continue;   // 不合理的數字（例如把脈搏 P:110 當成磷）跳過
      taken.push([s, e]);
      if (at[id] == null || s < at[id]) { at[id] = s; out[id] = x; }
    }
  }
  return PASTE_LABS.filter(l => out[l.id] != null).map(l => [l.id, out[l.id], pasteFlag(l.id, out[l.id])]);
}

function pasteParse(text) {
  const v = pasteVitals(text);
  const labs = pasteLabs(text);
  return { v, labs };
}
const PASTE_VNAME = { bt: 'BT', sbp: 'SBP', dbp: 'DBP', pr: 'HR', rr: 'RR', spo2: 'SpO2', sugar: 'Sugar', gcs: 'GCS' };
function pasteVitalsText(v) {
  const a = [];
  if (v.bt) a.push('BT ' + v.bt);
  if (v.sbp || v.dbp) a.push('BP ' + (v.sbp || '?') + '/' + (v.dbp || '?'));
  ['pr', 'rr', 'spo2', 'sugar', 'gcs'].forEach(k => { if (v[k]) a.push(PASTE_VNAME[k] + ' ' + v[k] + (k === 'spo2' ? '%' : '')); });
  return a.join('、');
}
/* labs → "Na 128 (L), K 5.9 (H)"；onlyAbn 只列異常的 */
function pasteLabText(labs, onlyAbn) {
  return labs.filter(l => !onlyAbn || l[2]).map(l => `${l[0]} ${l[1]}${l[2] ? ' (' + l[2] + ')' : ''}`).join(', ');
}
