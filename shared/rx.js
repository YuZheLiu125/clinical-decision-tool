/* 臨床輔助決策工具 · 共用醫囑庫（正本：shared/rx.js，由 scripts/sync_shared.py 寫進主訴處理、用藥速查、ACLS，不要直接改 HTML 裡這一段）
   一筆 = 一張可以直接開的醫囑：藥名、劑量、途徑、頻次／時間都寫在 o（英文醫囑文字）。
   rx(id, 分組, 名稱, o, 中文說明, {
     mon 監測, max 上限, ci 禁忌／先確認,
     adj {r, r30, hd, hepatic, hf, elderly, preg}  該狀態下要注意什麼；以「✕」開頭＝禁用
     alt {同上}                                     該狀態下整張醫囑換成這一句
     kg  {lo, hi, u, max, t}                        依體重計算的單次劑量（每 kg）
     cc  主訴處理的主訴 id（用藥速查連回去用）
   })
   成人劑量。來源與年份記在 CHANGELOG；台灣品項含量可能不同，開立前核對院內藥典。 */
const RX = {};
const RXG = [
  ['lyte', '電解質矯正'], ['fluid', '輸液・升壓・休克'], ['cv', '心血管'], ['resp', '呼吸'],
  ['neuro', '神經・精神'], ['sed', '鎮靜・插管用藥'], ['pain', '止痛・退燒'], ['gi', '腸胃'],
  ['endo', '血糖'], ['allergy', '過敏・輸血反應'], ['heme', '出血・輸血・抗凝'], ['abx', '抗生素（含腎劑量）'],
];
const RX_ST = { r: 'eGFR 30–59', r30: 'eGFR <30', hd: '透析', hepatic: '肝功能不全', hf: '心衰竭', elderly: '高齡 ≥65', preg: '懷孕' };
const rx = (id, g, n, o, d, x) => { RX[id] = Object.assign({ id, g, n, o, d }, x || {}); };

/* ───────── 電解質 ───────── */
rx('kcl_po', 'lyte', 'KCl 口服（Slow-K／KCl 口服液）', 'KCl 20 mEq PO BID with meals; recheck K next morning',
  'K 3.0–3.4、可進食。Slow-K 600 mg/錠＝8 mEq（2–3 錠 BID–TID）。每補 10 mEq 血鉀約升 0.1 mEq/L。',
  { cc: 'hypok', mon: '隔天晨血追 K；同時驗 Mg（低血鎂不補，鉀補不上來）', max: '口服單次 ≤40 mEq',
    adj: { r: '劑量減半，補完 4–6 小時就複驗', r30: '只在 K <3.0 或有症狀時補；單次 10–20 mEq 後複驗再決定', hd: '只在 K <3.0 或有症狀時補；單次 10–20 mEq 後複驗，並告知透析室' },
    alt: { r: 'KCl 10 mEq PO BID with meals; recheck K in 6 h', r30: 'KCl 10 mEq PO once; recheck K in 4–6 h', hd: 'KCl 10 mEq PO once; recheck K in 4–6 h' } });
rx('kcl_iv', 'lyte', 'KCl 靜脈滴注（周邊）', 'KCl 20 mEq in N/S 500 mL IVD over 4 h (peripheral line); recheck K 1–2 h after infusion',
  'K <3.0、有症狀、ECG 變化或無法口服。周邊濃度 ≤40 mEq/L、速率 ≤10 mEq/h。不可 IV push。不要泡在含糖輸液（胰島素分泌會讓鉀更低）。',
  { cc: 'hypok', mon: '滴完 1–2 小時複驗 K；注射部位疼痛、靜脈炎', max: '周邊 ≤10 mEq/h；一天一般 ≤200 mEq', ci: '無尿或少尿先確認腎功能',
    adj: { r: '每次 10–20 mEq，每補一次就複驗', r30: '每次 10 mEq，滴完複驗再決定下一劑', hd: '每次 10 mEq，滴完複驗；告知透析室', hf: '限水者改走中央靜脈濃縮給法或口服，不要用大量輸液補鉀' },
    alt: { r30: 'KCl 10 mEq in N/S 250 mL IVD over 2 h; recheck K after infusion', hd: 'KCl 10 mEq in N/S 250 mL IVD over 2 h; recheck K after infusion' } });
rx('kcl_cvc', 'lyte', 'KCl 靜脈滴注（中央靜脈、需 monitor）', 'KCl 20 mEq in N/S 100 mL IVD via central line over 2 h (10 mEq/h) with continuous ECG monitoring; recheck K after infusion',
  'K <2.5、心律不整或肌肉無力。只走中央靜脈，要有 ECG monitor。危及生命時可到 20 mEq/h，先與學長姊確認。',
  { cc: 'hypok', mon: '連續 ECG；每 20 mEq 複驗 K', max: '一般 10 mEq/h；危急 20 mEq/h（ICU 等級）',
    adj: { r30: '每次 10 mEq 後複驗', hd: '每次 10 mEq 後複驗' } });
rx('mgso4_iv', 'lyte', 'MgSO4 靜脈補充', 'MgSO4 2 g (10% 20 mL) in N/S 100 mL IVD over 2 h; recheck Mg next morning',
  'Mg <1.5 mg/dL、合併低血鉀或低血鈣、QT 延長。10% MgSO4 20 mL＝2 g＝16 mEq。滴太快會潮紅、低血壓。',
  { cc: 'hypomgp', mon: '隔天晨血 Mg；膝反射、呼吸、血壓（高血鎂徵象）', max: '非急症 ≤1 g/h',
    adj: { r: '劑量減半', r30: '劑量減半以下，每劑後驗 Mg；膝反射消失就停', hd: '只在有症狀或心律不整時給 1 g，給完驗 Mg' },
    alt: { r30: 'MgSO4 1 g (10% 10 mL) in N/S 100 mL IVD over 2 h; recheck Mg in 6 h', hd: 'MgSO4 1 g (10% 10 mL) in N/S 100 mL IVD over 2 h; recheck Mg in 6 h' } });
rx('mgso4_tdp', 'lyte', 'MgSO4（Torsades de pointes／嚴重低血鎂）', 'MgSO4 2 g (10% 20 mL) IV slow push over 15 min (pulseless: over 1–2 min); may repeat once',
  '多形性 VT 合併 QT 延長，不論血鎂多少都給。有脈搏 15 分鐘推完；沒有脈搏 1–2 分鐘。',
  { cc: 'hypomgp', mon: '連續 ECG、血壓；同時把 K 補到 ≥4', adj: { r30: '首劑照給（救命），之後不要重複，驗 Mg' } });
rx('mgo_po', 'lyte', 'MgO 口服', 'Magnesium oxide 250 mg PO TID',
  '輕度低血鎂（1.5–1.8）且無症狀。會腹瀉，腹瀉本身又會流失鎂。',
  { cc: 'hypomgp', adj: { r30: '✕ 排不掉，會高血鎂', hd: '✕ 排不掉，會高血鎂', r: '減為 QD–BID，追 Mg' } });
rx('ca_hyperk', 'lyte', 'Calcium gluconate（高血鉀穩定心肌）', '10% calcium gluconate 30 mL (3 g) IV slow push over 10 min with ECG monitoring; repeat in 5–10 min if ECG changes persist',
  'K ≥6.5 或 ECG 有變化（peaked T、QRS 變寬、PR 延長）。只穩定心肌，不降血鉀；效果 30–60 分鐘。10 mL/支，給 3 支；院內習慣一次 1 支的話，ECG 沒改善就接著給到 3 支。',
  { cc: 'hyperk', mon: '連續 ECG', ci: '使用 digoxin 者改成 100 mL D5W 滴 20–30 分鐘', adj: { r30: '不需調整', hd: '不需調整' } });
rx('ri_hyperk', 'lyte', 'Regular insulin＋葡萄糖（把鉀趕進細胞）', 'Regular insulin 10 U IV push + 50% glucose 50 mL IV push; finger sugar q1h x 6 h',
  '15 分鐘起效、維持 4–6 小時、降 0.6–1.2 mEq/L。血糖 >250 可以不給葡萄糖；治療前血糖 <126 mg/dL 的人，之後接 10% glucose 50 mL/h 滴 5 小時。',
  { cc: 'hyperk', mon: '血糖 q1h ×6 小時（低血糖常在 1–3 小時出現）；1–2 小時複驗 K',
    adj: { r: '低血糖風險高，考慮 5 U', r30: '低血糖風險高：這裡換成 5 U（觀察性研究；UKKA 2023 仍用 10 U 並加強補糖），血糖追滿 6 小時', hd: '低血糖風險高：這裡換成 5 U（觀察性研究；UKKA 2023 仍用 10 U 並加強補糖），血糖追滿 6 小時', elderly: '體重輕或給藥前血糖 <140 用 5 U' },
    alt: { r30: 'Regular insulin 5 U IV push + 50% glucose 50 mL IV push; finger sugar q1h x 6 h', hd: 'Regular insulin 5 U IV push + 50% glucose 50 mL IV push; finger sugar q1h x 6 h' } });
rx('salb_hyperk', 'lyte', 'Salbutamol 吸入（高血鉀）', 'Salbutamol 10 mg nebulization over 10 min',
  '30 分鐘起效、降 0.5–1 mEq/L；是氣喘劑量的 4 倍。約三成病人沒反應，不要單獨使用。',
  { cc: 'hyperk', mon: '心跳、心悸', ci: '心搏過速、缺血性心臟病要小心' });
rx('bicarb', 'lyte', 'Sodium bicarbonate', 'Sodium bicarbonate 7% 60 mL (50 mEq) IV slow push over 5 min',
  '只在合併代謝性酸中毒（pH <7.2）時用；降鉀效果慢且不穩定。7% 20 mL/支＝16.6 mEq。',
  { cc: 'hyperk', mon: 'Na、容積狀態、iCa（鹼化會降游離鈣）', adj: { hf: '鈉負荷大，容易肺水腫', hd: '鈉與水排不掉，優先安排透析' } });
rx('kalimate', 'lyte', 'Kalimate（calcium polystyrene sulfonate）', 'Calcium polystyrene sulfonate (Kalimate) 15 g PO TID',
  '把鉀排出體外，數小時到一天才有效，不是急救藥。意識不清、腸阻塞、術後腸道未通不要給。',
  { cc: 'hyperk', mon: '排便、腹脹', ci: '腸阻塞、腸缺血、術後 ileus' });
rx('lokelma', 'lyte', 'Lokelma（sodium zirconium cyclosilicate）', 'Sodium zirconium cyclosilicate (Lokelma) 10 g PO TID for up to 48 h, then 5 g QD',
  '1 小時起效，比 Kalimate 快。每 5 g 含鈉 400 mg。仿單急性期最多 48 小時（UKKA 2023 用到 72 小時）。',
  { cc: 'hyperk', mon: '水腫、K（低血鉀）', adj: { hf: '含鈉，注意水腫' } });
rx('nacl3', 'lyte', '3% NaCl bolus', '3% NaCl 150 mL IVD over 20 min; recheck Na immediately after; may repeat up to 2 more times until Na rises 5 mEq/L or symptoms improve',
  '低血鈉合併抽搐、昏迷、嘔吐加意識變差。目標先升 4–6 mEq/L 就停，不是矯正到正常。',
  { cc: 'hypona', mon: '每劑後驗 Na，之後 q2–4h；尿量（突然大量排尿＝矯正過快的前兆）', max: '第一個 24 小時上升 ≤10 mEq/L（歐洲 2014）；ODS 高風險（酗酒、營養不良、低血鉀、肝病）抓 ≤8',
    adj: { hf: '容積負荷：可改 100 mL，給完聽肺', hepatic: 'ODS 高風險，24 小時 ≤8 mEq/L' } });
rx('ddavp_rescue', 'lyte', 'Desmopressin（低血鈉矯正過快）', 'Desmopressin 2 mcg IV q8h + D5W 3 mL/kg IVD over 1 h; recheck Na q2h',
  '矯正超過上限或尿量突然 >100 mL/h 且尿稀時，把血鈉拉回來。先與學長姊、腎臟科確認。',
  { cc: 'hypona', mon: 'Na q2h、尿量', kg: { lo: 3, hi: 3, u: 'mL', t: 'D5W' } });
rx('d5w_hyperna', 'lyte', 'D5W（補自由水）', 'D5W IVD at 1.35 mL/kg/h (lowers Na about 10 mEq/L per day); recheck Na q4–6h',
  '慢性或不明時程的高血鈉：一天降 ≤10–12 mEq/L。低血容先用 N/S 把血壓補起來。能用腸道就用腸道補水。',
  { cc: 'hyperna', mon: 'Na q4–6h、血糖（D5W 會高血糖，高血糖滲透性利尿會更糟）、尿量', max: '慢性：一天降 ≤12 mEq/L',
    kg: { lo: 1.35, hi: 1.35, u: 'mL/h', t: 'D5W 速率' },
    adj: { hf: '改用腸道補水為主，輸液速率減半並聽肺', r30: '排水能力差，速率減半、Na q4h', hd: '與腎臟科討論，用透析矯正' } });
rx('water_ng', 'lyte', '腸道補水', 'Free water 200 mL via NG/PO q4h',
  '腸道可用時最安全的補水方式。',
  { cc: 'hyperna', mon: 'Na q6–12h、嗆咳', adj: { hf: '改 100–150 mL q4h' } });
rx('ca_hypoca', 'lyte', 'Calcium gluconate（有症狀的低血鈣）', '10% calcium gluconate 20 mL (2 g) in D5W 100 mL IVD over 20 min with ECG monitoring',
  '抽筋、tetany、喉痙攣、抽搐、QT 延長，或校正鈣 <7.5 mg/dL。一劑只能維持 2–3 小時，之後接持續滴注或口服。',
  { cc: 'hypoca', mon: 'ECG；1–2 小時後驗 iCa；注射部位（外滲會組織壞死）', ci: '不可與 bicarbonate、phosphate 同一條線；使用 digoxin 者慢滴',
    adj: { r30: '高血磷時補鈣會鈣磷沉積，只在有症狀時補，並同時處理高血磷', hd: '同左；無症狀者交給透析調整' } });
rx('ca_drip', 'lyte', 'Calcium gluconate 持續滴注', '10% calcium gluconate 100 mL (10 g) in D5W 900 mL IVD at 50 mL/h; adjust by iCa q4–6h',
  '約 0.9 mg/mL 元素鈣，50 mL/h 起（0.5–1.5 mg/kg/h）。同時開始口服鈣與活性維生素 D。',
  { cc: 'hypoca', mon: 'iCa q4–6h；Mg（低血鎂要先補）', adj: { hf: '輸液量大，可改濃縮走中央靜脈' } });
rx('caco3_po', 'lyte', '口服鈣＋活性維生素 D', 'Calcium carbonate 500 mg PO TID with meals + calcitriol 0.25 mcg PO QD',
  '輕度、無症狀的低血鈣。隨餐吃可同時當磷結合劑；要補鈣吸收好就空腹吃。',
  { cc: 'hypoca', mon: 'Ca、P 每 2–3 天', adj: { r30: '首選（同時結合磷）；注意鈣磷乘積' } });
rx('ns_hyperca', 'lyte', 'N/S 大量輸液（高血鈣）', 'N/S IVD at 200 mL/h; adjust to urine output 100–150 mL/h',
  '高血鈣的病人幾乎都脫水，補水是第一步。水補夠之前不要給 loop diuretic。',
  { cc: 'hyperca', mon: 'I/O、肺部聽診、Ca 與電解質 q6–12h',
    adj: { hf: '速率減半，肺水腫時加 Furosemide', r30: '排不掉會 overload；與腎臟科討論透析', hd: '與腎臟科討論低鈣透析液' },
    alt: { hf: 'N/S IVD at 100 mL/h; reassess lung sounds and urine output q2h', r30: 'N/S IVD at 100 mL/h; reassess volume status q2h' } });
rx('calcitonin', 'lyte', 'Calcitonin', 'Calcitonin 4 IU/kg SC q12h for 48 h',
  '4–6 小時起效，最快。48 小時後會失效（tachyphylaxis），要同時給 bisphosphonate 接手。',
  { cc: 'hyperca', kg: { lo: 4, hi: 4, u: 'IU' }, mon: 'Ca q12h', adj: { r30: '不需調整，腎差時的首選降鈣藥' } });
rx('zoledronate', 'lyte', 'Zoledronic acid', 'Zoledronic acid 4 mg in N/S 100 mL IVD over 15 min once',
  '2–4 天才見效，維持數週。先把水補起來再給。',
  { cc: 'hyperca', mon: 'Cr、Ca、P、Mg', ci: '近期要做侵入性牙科處置者小心（顎骨壞死）',
    adj: { r: '高血鈣這個適應症在 Cr <4.5 mg/dL 時仿單不要求減量（依 CrCl 減量的表是給骨轉移用的）；先把水補起來、給藥前後追 Cr', r30: '✕ 嚴重腎功能不全不建議，與腎臟科討論 Denosumab 120 mg SC', hd: '✕ 與腎臟科討論 Denosumab 或透析' } });
rx('kphos_iv', 'lyte', 'Potassium phosphate 靜脈', 'Potassium phosphate 15 mmol in N/S 250 mL IVD over 4–6 h; recheck P, K, Ca after infusion',
  'P <1.0 mg/dL，或 <2.0 合併肌肉無力、呼吸肌無力、脫離呼吸器困難。每 3 mmol 磷帶 4.4 mEq 鉀；K >4 改用 sodium phosphate。',
  { cc: 'hypomgp', mon: '滴完驗 P、K、Ca（會低血鈣）', max: '≤7.5 mmol/h',
    adj: { r: '劑量減半', r30: '劑量減半以下，只在有症狀時給', hd: '只在嚴重且有症狀時給，與腎臟科確認' },
    alt: { r30: 'Potassium phosphate 7.5 mmol in N/S 250 mL IVD over 6 h; recheck P, K, Ca after infusion' } });
rx('phos_po', 'lyte', '口服磷', 'Sodium/potassium phosphate 500 mg (16 mmol P) PO TID',
  'P 1.0–2.0、無症狀。常見副作用是腹瀉。',
  { cc: 'hypomgp', adj: { r30: '減半並追 P、K' } });

/* ───────── 輸液・休克 ───────── */
rx('ns_bolus', 'fluid', 'Crystalloid bolus', 'N/S (or lactated Ringer) 500 mL IV bolus over 15 min; reassess BP, HR, lung sounds and urine output, repeat if fluid-responsive',
  '低血壓、疑低血容。每給一次就重新評估，沒有反應不要一直灌。',
  { cc: 'hypotension', mon: '血壓、心跳、呼吸音、SpO2、尿量',
    adj: { hf: '250 mL 一次，給完就聽肺', r30: '250 mL 一次；少尿者容易 overload', hd: '250 mL 一次；無尿病人排不掉' },
    alt: { hf: 'N/S 250 mL IV bolus over 15 min; reassess lung sounds and BP before repeating', r30: 'N/S 250 mL IV bolus over 15 min; reassess before repeating', hd: 'N/S 250 mL IV bolus over 15 min; reassess before repeating' } });
rx('sepsis_fluid', 'fluid', 'Sepsis 輸液復甦', 'Balanced crystalloid 30 mL/kg IV within the first 3 h (give in 500 mL boluses, reassess after each)',
  'Sepsis 合併低血壓或 lactate ≥4 mmol/L。用實際體重；BMI >30 用理想體重。',
  { cc: 'fever', kg: { lo: 30, hi: 30, u: 'mL', t: '總量' }, mon: '每 500 mL 評估一次；lactate 2–4 小時後複驗',
    adj: { hf: '分次 250 mL，邊給邊聽肺；提早接 norepinephrine', hd: '分次 250 mL；提早接 norepinephrine', r30: '分次 250–500 mL，注意 overload' } });
rx('norepi', 'fluid', 'Norepinephrine（Levophed）', 'Norepinephrine 4 mg in D5W 250 mL (16 mcg/mL), start 0.05 mcg/kg/min IVD, titrate q5min to MAP ≥65 mmHg',
  '輸液後 MAP 仍 <65 的第一線升壓劑。中央靜脈優先；來不及可先走肘窩以上的大口徑周邊線，盡快換。',
  { cc: 'hypotension', kg: { lo: 0.19, hi: 0.19, u: 'mL/h', t: '起始速率（16 mcg/mL）' }, mon: 'A-line 或 q5min 量血壓；周邊給藥看外滲', max: '一般 ≤1 mcg/kg/min；>0.25 加第二種藥',
    ci: '外滲會組織壞死（phentolamine 5–10 mg 局部浸潤）' });
rx('epi_im', 'fluid', 'Epinephrine IM（過敏性休克）', 'Epinephrine 0.5 mg (1 mg/mL, 0.5 mL) IM at anterolateral thigh; repeat q5–15 min if no improvement',
  '過敏性休克的唯一第一線。大腿前外側肌肉注射，不要皮下、不要直接 IV push。',
  { cc: 'allergy', mon: '血壓、心跳、SpO2、喘鳴；至少觀察 4–6 小時（雙相反應）',
    adj: { elderly: '冠心病者仍然要給，可用 0.3 mg；不給的風險更高', preg: '照給，母親低血壓對胎兒更危險' } });
rx('epi_drip', 'fluid', 'Epinephrine 滴注', 'Epinephrine 2 mg in D5W 250 mL (8 mcg/mL), start 2 mcg/min (15 mL/h) IVD, titrate to 2–10 mcg/min',
  '過敏性休克打了 2–3 劑 IM 沒效，或有症狀的心搏過緩 atropine 無效。',
  { cc: 'brady', mon: '連續 ECG、血壓', ci: '走中央靜脈或大口徑周邊線' });
rx('dopamine', 'fluid', 'Dopamine', 'Dopamine 400 mg in D5W 250 mL (1600 mcg/mL), start 5 mcg/kg/min IVD, titrate to 5–20 mcg/kg/min',
  '有症狀的心搏過緩 atropine 無效、等待 pacing 時。',
  { cc: 'brady', kg: { lo: 0.19, hi: 0.19, u: 'mL/h', t: '5 mcg/kg/min 的速率（1600 mcg/mL）' }, mon: '連續 ECG、血壓；心律不整' });
rx('hydrocort_shock', 'fluid', 'Hydrocortisone（腎上腺危象／頑固休克）', 'Hydrocortisone 100 mg IV stat, then 50 mg IV q6h',
  '長期用類固醇突然停藥或遇到壓力、升壓劑反應差的休克。疑腎上腺危象不要等 cortisol 報告。',
  { cc: 'hypotension', mon: '血糖、Na、K' });

/* ───────── 心血管 ───────── */
rx('furosemide_iv', 'cv', 'Furosemide（Lasix）IV', 'Furosemide 40 mg IV push over 2 min; reassess urine output in 2 h (target >100 mL/h), double the dose if inadequate',
  '肺水腫、volume overload。沒用過利尿劑 20–40 mg；長期口服者給「每日口服總量的 1–2.5 倍」IV。',
  { cc: 'dyspnea', mon: '2 小時尿量、血壓、K、Mg、Cr', max: '單次 ≤200 mg；推注 ≤4 mg/min（耳毒性）',
    adj: { r: '需要較高劑量才有反應，從 40–80 mg 起', r30: '從 80 mg 起，無效加倍到 160–200 mg', hd: '還有尿的病人才有用（80–160 mg）；無尿者安排緊急透析或 UF', elderly: '20 mg 起，注意低血壓與低血鉀' },
    alt: { r30: 'Furosemide 80 mg IV push over 20 min; reassess urine output in 2 h, double the dose if inadequate' } });
rx('ntg_sl', 'cv', 'Nitroglycerin 舌下', 'Nitroglycerin 0.6 mg SL q5min PRN chest pain, up to 3 doses; hold if SBP <90 mmHg',
  '缺血性胸痛。給之前量血壓、做完 12-lead ECG。',
  { cc: 'chestpain', mon: '每次給藥前後血壓', ci: '24 小時內用過 sildenafil／48 小時內 tadalafil、右心室梗塞、嚴重主動脈瓣狹窄、SBP <90' });
rx('ntg_iv', 'cv', 'Nitroglycerin 滴注', 'Nitroglycerin 50 mg in D5W 250 mL (200 mcg/mL), start 10 mcg/min (3 mL/h) IVD, increase by 5–10 mcg/min q5min; hold if SBP <100 mmHg',
  '持續胸痛、高血壓合併急性肺水腫。',
  { cc: 'chestpain', mon: '血壓 q5–15min、頭痛', max: '一般 ≤200 mcg/min', ci: '同舌下 NTG' });
rx('aspirin_load', 'cv', 'Aspirin loading', 'Aspirin 300 mg PO chewed once, then 100 mg PO QD',
  '疑 ACS：越早越好，嚼碎吞下。先排除主動脈剝離與活動性出血。',
  { cc: 'chestpain', ci: '活動性出血、aspirin 過敏、疑主動脈剝離', adj: { r30: '不需調整' } });
rx('captopril', 'cv', 'Captopril（Cabudan）', 'Captopril 25 mg PO once; recheck BP in 1 h',
  '沒有器官損傷的血壓高：先處理疼痛、脹氣、尿滯留，再給口服藥。目標是幾小時到幾天內慢慢降。',
  { cc: 'hypertension', mon: '1 小時後量血壓；K、Cr',
    adj: { r: 'AKI 或高血鉀時不要用，改 Amlodipine', r30: '✕ AKI 或 K 偏高時禁用；穩定的 CKD 從 12.5 mg 起', hd: '12.5 mg 起，注意高血鉀', preg: '✕ 懷孕禁用，改 Labetalol 或 Nifedipine', elderly: '12.5 mg 起，避免降太快' },
    alt: { elderly: 'Captopril 12.5 mg PO once; recheck BP in 1 h', hd: 'Captopril 12.5 mg PO once; recheck BP in 1 h' } });
rx('amlodipine', 'cv', 'Amlodipine（Norvasc）', 'Amlodipine 5 mg PO once, then QD if BP remains high',
  '不能用 ACEI 時的選擇。起效慢（6–12 小時），不會一下降太多。',
  { cc: 'hypertension', adj: { hepatic: '2.5 mg 起', elderly: '2.5 mg 起', r30: '不需調整' }, alt: { hepatic: 'Amlodipine 2.5 mg PO once, then QD if BP remains high' } });
rx('labetalol_iv', 'cv', 'Labetalol（Trandate）IV', 'Labetalol 10 mg IV slow push over 2 min; may repeat or double q10min (max 300 mg per 24 h)',
  '高血壓急症、不能口服時。Trandate 25 mg/5 mL：0.5 amp≈12.5 mg，加 N/S 稀釋慢推。',
  { cc: 'hypertension', mon: '血壓、心跳 q5–10min', ci: '氣喘、心跳 <60、二度以上 AV block、急性失代償心衰竭',
    adj: { hf: '✕ 急性失代償時避免，改 NTG 或 Nicardipine', preg: '孕期首選之一', hepatic: '代謝變慢，拉長間隔' } });
rx('nicardipine_iv', 'cv', 'Nicardipine（Perdipine）滴注', 'Nicardipine 5 mg/h IVD, increase by 2.5 mg/h q5–15min to target BP (max 15 mg/h)',
  '高血壓急症：第一小時 MAP 降幅 ≤25%（主動脈剝離、腦出血另有目標）。',
  { cc: 'hypertension', mon: 'A-line 或 q5min 量血壓；周邊靜脈炎（12 小時換部位）', ci: '嚴重主動脈瓣狹窄', adj: { hf: '可用，但注意反射性心跳快', hepatic: '減量慢調' } });
rx('adenosine', 'cv', 'Adenosine', 'Adenosine 6 mg rapid IV push followed by 20 mL N/S flush; if no conversion in 1–2 min, 12 mg rapid IV push',
  '規則的窄 QRS 心搏過速（SVT）。走最靠近心臟的大口徑線，推完馬上沖水、抬高手臂。先告訴病人會胸悶幾秒。',
  { cc: 'tachycardia', mon: '全程印 ECG 條', ci: '氣喘發作中、二度以上 AV block、不規則寬 QRS（預激合併 AF）',
    adj: { hf: '心臟移植、走中央靜脈、併用 dipyridamole 或 carbamazepine：起始 3 mg' } });
rx('diltiazem_iv', 'cv', 'Diltiazem（Herbesser）IV', 'Diltiazem 0.25 mg/kg (about 15–20 mg) IV over 2 min; if needed 0.35 mg/kg after 15 min; then 5–15 mg/h IVD',
  'AF／AFL 快速心室反應、血壓穩定、心臟收縮功能正常。',
  { cc: 'tachycardia', kg: { lo: 0.25, hi: 0.25, u: 'mg', max: 25, t: '首劑' }, mon: '血壓、心跳、ECG', ci: '低血壓、WPW 合併 AF、二度以上 AV block',
    adj: { hf: '✕ HFrEF 或急性失代償禁用，改 Amiodarone 或 Digoxin', elderly: '首劑 10 mg', hepatic: '減量' } });
rx('amiodarone_iv', 'cv', 'Amiodarone 靜脈', 'Amiodarone 150 mg in D5W 100 mL IVD over 10 min, then 1 mg/min for 6 h, then 0.5 mg/min for 18 h',
  '穩定的寬 QRS 心搏過速；心衰竭病人的 AF 控速。只能用 D5W 稀釋。',
  { cc: 'tachycardia', mon: '血壓（低血壓多半跟滴速有關）、QTc、心跳；周邊靜脈炎', max: '24 小時 ≤2.2 g', ci: 'QT 延長、甲狀腺疾病、碘過敏；預激合併 AF 不要用',
    adj: { hepatic: '肝毒性，追肝指數', r30: '不需調整' } });
rx('digoxin_iv', 'cv', 'Digoxin 靜脈', 'Digoxin 0.25 mg IV slow push q6h x 2 doses (total 0.5 mg), then reassess',
  '心衰竭或低血壓病人的 AF 控速。起效慢（數小時）。',
  { cc: 'tachycardia', mon: 'K、Mg、Cr；隔天 digoxin level', ci: 'WPW、肥厚型心肌病、低血鉀未矯正',
    adj: { r: '負荷劑量減半', r30: '只給 0.125 mg 一次，不排維持劑量，驗濃度再決定', hd: '只給 0.125 mg 一次，驗濃度再決定', elderly: '負荷劑量減半' },
    alt: { r30: 'Digoxin 0.125 mg IV slow push once; check digoxin level before further doses', hd: 'Digoxin 0.125 mg IV slow push once; check digoxin level before further doses' } });
rx('bisoprolol', 'cv', 'Bisoprolol（Concor）', 'Bisoprolol 1.25 mg PO QD',
  '血壓穩定的 AF 控速、竇性心搏過速的原因已處理後。急性失代償心衰竭先不要新加。',
  { cc: 'tachycardia', ci: '心跳 <60、二度以上 AV block、急性失代償心衰竭、氣喘發作中', adj: { r30: '起始 1.25 mg，上限 10 mg/day', hepatic: '上限 10 mg/day' } });
rx('atropine', 'cv', 'Atropine', 'Atropine 1 mg IV push q3–5min PRN symptomatic bradycardia (max 3 mg)',
  '有症狀的心搏過緩（低血壓、意識改變、胸痛、心衰竭）。劑量 <0.5 mg 可能反而更慢。',
  { cc: 'brady', mon: '連續 ECG', ci: '移植心臟、Mobitz II、三度阻滯合併寬 QRS 多半無效：直接準備 pacing' });
rx('enoxaparin_tx', 'cv', 'Enoxaparin（Clexane）治療劑量', 'Enoxaparin 1 mg/kg SC q12h',
  'DVT、PE、ACS 的抗凝。開之前確認沒有活動性出血、血小板 >50k。',
  { cc: 'dyspnea', kg: { lo: 1, hi: 1, u: 'mg', t: '每劑' }, mon: 'CBC（血小板）、出血、Cr', ci: '活動性出血、HIT 病史、24 小時內要做腰椎穿刺或手術',
    adj: { r: 'CrCl 30–50 不調，但出血風險增加', r30: 'CrCl <30 改 1 mg/kg QD', hd: '✕ 改用 Heparin 滴注', elderly: '≥75 歲 ACS：不給 bolus、0.75 mg/kg q12h' },
    alt: { r30: 'Enoxaparin 1 mg/kg SC q24h' } });
rx('heparin_drip', 'cv', 'Heparin 滴注', 'Heparin 80 U/kg IV bolus, then 18 U/kg/h IVD; aPTT q6h, target 1.5–2.5 x control',
  '腎功能差、可能要手術或出血風險高（半衰期短、可逆轉）時的抗凝選擇。',
  { cc: 'dyspnea', kg: { lo: 80, hi: 80, u: 'U', max: 10000, t: 'bolus' }, mon: 'aPTT q6h 到穩定、血小板 q2–3 天', ci: '活動性出血、HIT', adj: { r30: '不需調整，腎差首選', hd: '不需調整，腎差首選' } });

/* ───────── 呼吸 ───────── */
rx('o2', 'resp', '氧氣', 'O2 via nasal cannula 2–4 L/min, titrate to SpO2 92–96% (COPD with CO2 retention: 88–92%)',
  'SpO2 <92% 才需要。鼻導管 1–6 L/min；mask 5–10；non-rebreathing 10–15；還不夠就 HFNC 或 NIV。',
  { cc: 'dyspnea', mon: 'SpO2、呼吸型態；CO2 滯留者 30–60 分鐘後追 ABG' });
rx('neb_saba', 'resp', 'Salbutamol＋Ipratropium 吸入', 'Salbutamol 2.5 mg + ipratropium 0.5 mg nebulization q20min x 3 doses, then q4–6h PRN wheezing',
  '氣喘或 COPD 急性發作、有 wheezing。',
  { cc: 'dyspnea', mon: '心跳、K（大量使用會低血鉀）、SpO2', adj: { hf: '心搏過速、缺血者拉長間隔' } });
rx('steroid_ae', 'resp', '全身性類固醇（氣喘／COPD 發作）', 'Prednisolone 40 mg PO QD for 5 days (if NPO: methylprednisolone 40 mg IV QD)',
  '中重度發作都要給，口服與靜脈效果相同。5 天不需要 taper。',
  { cc: 'dyspnea', mon: '血糖（糖尿病人加驗 finger sugar）', adj: { elderly: '注意譫妄、失眠，早上給' } });
rx('mgso4_asthma', 'resp', 'MgSO4（嚴重氣喘）', 'MgSO4 2 g (10% 20 mL) in N/S 100 mL IVD over 20 min once',
  '吸入支氣管擴張劑反應不好的嚴重氣喘發作。',
  { cc: 'dyspnea', mon: '血壓、膝反射', adj: { r30: '給 1 g，注意高血鎂' } });
rx('naloxone', 'resp', 'Naloxone', 'Naloxone 0.04 mg IV q2–3min, titrate to RR ≥12/min (dilute 0.4 mg in N/S to 10 mL, give 1 mL each time); apnea or arrest: 0.4–2 mg IV',
  '鴉片類造成的呼吸抑制（RR <8–10、瞳孔縮小、叫不醒）。小量分次給，避免急性戒斷與劇痛。',
  { cc: 'ams', mon: '呼吸、意識至少 2 小時：naloxone 只有 30–90 分鐘，比多數鴉片短，會再睡回去', adj: { r30: 'morphine 代謝物累積，常需要重複給或持續滴注' } });
rx('flumazenil', 'resp', 'Flumazenil', 'Flumazenil 0.2 mg IV over 30 s; repeat 0.2 mg q1min PRN (max 1 mg)',
  '醫療給藥造成的 benzodiazepine 過度鎮靜。',
  { cc: 'ams', mon: '意識、呼吸；1 小時內可能再鎮靜', ci: '長期使用 BZD、癲癇病史、可能合併 TCA 中毒：會誘發抽搐，不要給', adj: { hepatic: '重複劑量減半' } });
rx('txa_iv', 'resp', 'Tranexamic acid（Transamin）IV', 'Tranexamic acid 500 mg IV slow push over 10 min q8h',
  '咳血、黏膜出血的輔助止血。',
  { cc: 'hemoptysis', mon: '出血量、抽搐', ci: '活動性血栓、肉眼血尿（會形成血塊阻塞）',
    adj: { r: '仿單以 Cr 分級：1.36–2.83 mg/dL 每次 10 mg/kg BID（約 500 mg q12h）', r30: 'Cr 2.83–5.66 mg/dL：10 mg/kg QD（約 500 mg q24h）；蓄積會抽搐', hd: 'Cr >5.66 mg/dL：10 mg/kg q48h 或 5 mg/kg q24h' },
    alt: { r: 'Tranexamic acid 500 mg IV slow push over 10 min q12h', r30: 'Tranexamic acid 500 mg IV slow push over 10 min q24h', hd: 'Tranexamic acid 500 mg IV slow push over 10 min q48h (after dialysis)' } });
rx('txa_neb', 'resp', 'Tranexamic acid 吸入', 'Tranexamic acid 500 mg (5 mL) nebulization TID for up to 5 days',
  '非大量咳血。全身吸收少，腎功能差也可以用。',
  { cc: 'hemoptysis', mon: '支氣管痙攣' });
rx('codeine_cough', 'resp', 'Codeine 止咳', 'Codeine 15–30 mg PO q6h PRN cough',
  '咳血時壓制劇烈咳嗽；一般乾咳也可用。大量咳血不要完全壓住咳嗽反射。',
  { cc: 'cough', mon: '呼吸、便秘', adj: { r30: '減半並拉長間隔', elderly: '15 mg 起', hepatic: '減量', preg: '✕ 避免' } });
rx('dextromethorphan', 'resp', 'Dextromethorphan（Medicon）', 'Dextromethorphan 30 mg PO TID PRN cough',
  '乾咳。有痰的咳嗽不要壓。',
  { cc: 'cough', ci: '併用 MAOI、linezolid（serotonin syndrome）' });
rx('acetylcysteine', 'resp', 'Acetylcysteine（Fluimucil）', 'Acetylcysteine 600 mg PO QD (or 200 mg TID)',
  '痰黏咳不出來。咳嗽力氣差的病人要搭配拍痰、抽痰。',
  { cc: 'cough', ci: '氣喘病人吸入劑型可能支氣管痙攣' });

/* ───────── 神經・精神 ───────── */
rx('lorazepam_sz', 'neuro', 'Lorazepam（抽搐）', 'Lorazepam 4 mg IV push at 2 mg/min; may repeat once after 5 min if still seizing',
  '抽搐 ≥5 分鐘，或連續發作中間沒有醒。體重 <40 kg 用 0.1 mg/kg。',
  { cc: 'seizure', kg: { lo: 0.1, hi: 0.1, u: 'mg', max: 4, t: '每劑' }, mon: '呼吸、SpO2、血壓；準備 BVM', adj: { elderly: '呼吸抑制風險高，但劑量不足更危險：照給、備好氣道', hepatic: 'BZD 裡的首選（不經 CYP）' } });
rx('midazolam_im', 'neuro', 'Midazolam IM（沒有 IV 的抽搐）', 'Midazolam 10 mg IM once (5 mg if body weight 13–40 kg)',
  '打不上 IV 時。不要為了找血管延誤第一劑。',
  { cc: 'seizure', mon: '呼吸、SpO2', adj: { elderly: '照給、備好氣道', r30: '活性代謝物蓄積，鎮靜時間拉長' } });
rx('levetiracetam_load', 'neuro', 'Levetiracetam（Keppra）負荷', 'Levetiracetam 60 mg/kg (max 4500 mg) in N/S 100 mL IVD over 10 min',
  '給完 benzodiazepine 還在抽（第二線）。交互作用最少。',
  { cc: 'seizure', kg: { lo: 60, hi: 60, u: 'mg', max: 4500 }, mon: '躁動、意識',
    adj: { r: '負荷劑量不調；維持 500–750 mg q12h', r30: '負荷劑量不調；維持 250–500 mg q12h', hd: '負荷劑量不調；維持 500–1000 mg QD，透析後補 250–500 mg' } });
rx('valproate_load', 'neuro', 'Valproate（Depakine）負荷', 'Valproate 40 mg/kg (max 3000 mg) IVD over 10 min',
  '第二線的另一個選擇。',
  { cc: 'seizure', kg: { lo: 40, hi: 40, u: 'mg', max: 3000 }, mon: 'ammonia、肝指數、血小板', ci: '併用 carbapenem 會讓濃度掉到無效',
    adj: { hepatic: '✕ 肝病禁用', preg: '✕ 致畸胎，改 Levetiracetam' } });
rx('phenytoin_load', 'neuro', 'Phenytoin 負荷', 'Phenytoin 20 mg/kg in N/S IVD at ≤50 mg/min with ECG and BP monitoring',
  '第二線。只能泡 N/S（遇糖會沉澱），要用 in-line filter。',
  { cc: 'seizure', kg: { lo: 20, hi: 20, u: 'mg', max: 1500 }, mon: '連續 ECG、血壓（低血壓、心律不整）；外滲會組織壞死', ci: '二度以上 AV block、竇性心搏過緩',
    adj: { elderly: '滴速 ≤25 mg/min', r30: '游離濃度升高，看 free level 或校正濃度', hepatic: '減量並追濃度' } });
rx('haloperidol', 'neuro', 'Haloperidol（Haldol）', 'Haloperidol 1 mg IM q30–60min PRN severe agitation (max 5 mg per 24 h)',
  '譫妄合併危及自己或他人的躁動，而且非藥物處置無效。先找原因（痛、尿滯留、缺氧、感染、藥物）。',
  { cc: 'ams', mon: 'QTc（>500 ms 不要給）、錐體外症狀', ci: 'Parkinson、Lewy body dementia、QT 延長',
    adj: { elderly: '0.5 mg 起，一天 ≤3 mg', hepatic: '減量' }, alt: { elderly: 'Haloperidol 0.5 mg IM q30–60min PRN severe agitation (max 3 mg per 24 h)' } });
rx('quetiapine', 'neuro', 'Quetiapine（Seroquel）', 'Quetiapine 12.5–25 mg PO HS PRN agitation',
  '能口服的譫妄躁動；Parkinson 或 Lewy body dementia 病人的首選。',
  { cc: 'ams', mon: '姿勢性低血壓、過度鎮靜、QTc', adj: { elderly: '12.5 mg 起', hepatic: '12.5 mg 起、慢調' } });
rx('thiamine', 'neuro', 'Thiamine', 'Thiamine 100 mg IV QD for 3 days (suspected Wernicke: 500 mg IV q8h for 2–3 days)',
  '酗酒、營養不良、長期嘔吐、refeeding 風險。在給葡萄糖之前或同時給。',
  { cc: 'ams' });
rx('lorazepam_aws', 'neuro', 'Lorazepam（酒精戒斷，症狀導向）', 'Lorazepam 2 mg PO/IV q1h PRN CIWA-Ar ≥8; reassess CIWA-Ar 1 h after each dose',
  '最後一杯酒後 6–48 小時出現手抖、冒汗、心跳快、焦慮。肝硬化、高齡用 Lorazepam（不靠肝臟氧化代謝）。',
  { cc: 'withdrawal', mon: 'CIWA-Ar q1h（≥8 給藥）到連續 3 次 <8，之後 q4–6h；呼吸、意識', max: '用量很大仍控制不住（>8 mg/h）→ ICU',
    adj: { elderly: '1 mg 起', hepatic: 'BZD 首選', r30: '不需調整' }, alt: { elderly: 'Lorazepam 1 mg PO/IV q1h PRN CIWA-Ar ≥8; reassess CIWA-Ar 1 h after each dose' } });
rx('diazepam_aws', 'neuro', 'Diazepam（酒精戒斷）', 'Diazepam 10 mg IV slow push q10–15min PRN until calm but awake (CIWA-Ar <8)',
  '嚴重戒斷或 DT。長效、可自行 taper。',
  { cc: 'withdrawal', mon: '呼吸、意識、SpO2', adj: { hepatic: '✕ 肝硬化會蓄積，改 Lorazepam', elderly: '✕ 蓄積、過度鎮靜，改 Lorazepam' } });
rx('trazodone', 'neuro', 'Trazodone（Mesyrel）', 'Trazodone 25–50 mg PO HS PRN insomnia',
  '住院失眠的藥物首選：不太會譫妄、跌倒風險較 BZD 低。先做非藥物處置。',
  { cc: 'insomnia', mon: '姿勢性低血壓', adj: { elderly: '25 mg 起', hepatic: '25 mg 起' } });
rx('zolpidem', 'neuro', 'Zolpidem（Stilnox）', 'Zolpidem 5 mg PO HS PRN insomnia',
  '平常就在吃的病人可以續用。',
  { cc: 'insomnia', ci: '夢遊、譫妄病史', adj: { elderly: '✕ 新開避免（譫妄、跌倒）；已長期使用者續用 5 mg', hepatic: '5 mg 為上限；嚴重肝病避免' } });
rx('mannitol', 'neuro', 'Mannitol', 'Mannitol 20% 0.5 g/kg (2.5 mL/kg) IVD over 20 min once',
  '腦疝徵象（瞳孔不等大、Cushing triad）等待處置時。先通知學長姊與神經外科。',
  { cc: 'headache', kg: { lo: 2.5, hi: 2.5, u: 'mL', t: '20% Mannitol' }, mon: 'Na、osmolality（>320 停）、尿量、血壓',
    adj: { r30: '排不掉會 overload，改 3% NaCl', hd: '✕ 改 3% NaCl', hf: '先擴容再利尿，肺水腫風險' } });

/* ───────── 鎮靜・插管 ───────── */
rx('sed_etomidate', 'sed', 'Etomidate（程序鎮靜）', 'Etomidate 0.1 mg/kg IV slow push over 30–60 s; may repeat 0.05 mg/kg q3–5min',
  '同步整流的首選之一：對血壓影響最小，1 分鐘內起效、維持 5–10 分鐘。會有肌躍動（不是抽搐）。',
  { kg: { lo: 0.1, hi: 0.15, u: 'mg' }, mon: 'SpO2、ETCO2、血壓；備好 BVM 與抽吸', adj: { elderly: '用下限劑量', hepatic: '作用時間拉長' } });
rx('sed_midazolam', 'sed', 'Midazolam（Dormicum）（程序鎮靜）', 'Midazolam 1–2 mg IV slow push q2–3min, titrate to effect (usual total ≤5 mg)',
  '最容易拿到。2–3 分鐘才到高峰，不要推太快又補太急。常搭配 Fentanyl（兩者併用呼吸抑制會加成）。',
  { kg: { lo: 0.02, hi: 0.05, u: 'mg', t: '總量' }, mon: 'SpO2、呼吸、血壓；備 Flumazenil',
    adj: { elderly: '每次 0.5–1 mg，總量減半', r30: '活性代謝物蓄積，鎮靜時間拉長', hd: '活性代謝物蓄積，鎮靜時間拉長', hepatic: '減量 50%' },
    alt: { elderly: 'Midazolam 0.5–1 mg IV slow push q2–3min, titrate to effect (usual total ≤2.5 mg)' } });
rx('sed_propofol', 'sed', 'Propofol（程序鎮靜）', 'Propofol 0.5 mg/kg IV slow push, then 0.25 mg/kg q1–3min PRN',
  '起效與恢復都最快。會掉血壓、抑制呼吸：已經低血壓的不穩定病人不要用。',
  { kg: { lo: 0.5, hi: 1, u: 'mg' }, mon: 'SpO2、ETCO2、血壓', ci: '低血壓、嚴重左心功能不全', adj: { elderly: '劑量減半、推慢', hf: '✕ 血壓不穩時避免，改 Etomidate' } });
rx('sed_ketamine', 'sed', 'Ketamine（程序鎮靜）', 'Ketamine 1 mg/kg IV slow push over 1 min; may repeat 0.5 mg/kg q5–10min PRN',
  '保留呼吸與氣道反射、兼有止痛，適合經皮節律器（TCP）。會讓心跳和血壓上升：心搏過速、缺血性胸痛的病人不是首選。',
  { kg: { lo: 1, hi: 1, u: 'mg', t: '首劑' }, mon: 'SpO2、血壓、甦醒期躁動（可給 Midazolam 1 mg）', ci: '缺血性心臟病發作中、嚴重高血壓', adj: { elderly: '首劑 0.5 mg/kg' } });
rx('sed_fentanyl', 'sed', 'Fentanyl（止痛）', 'Fentanyl 0.5–1 mcg/kg (25–50 mcg) IV slow push; may repeat q5min',
  '整流和 TCP 會痛：鎮靜藥大多不止痛，加一劑短效鴉片類。對血壓影響小。',
  { kg: { lo: 0.5, hi: 1, u: 'mcg' }, mon: '呼吸（與 BZD 併用加成）；備 Naloxone', adj: { elderly: '25 mcg 起', r30: '不需調整，腎差的鴉片類首選', hepatic: '重複給會蓄積' } });
rx('rsi_etomidate', 'sed', 'Etomidate（RSI 誘導）', 'Etomidate 0.3 mg/kg IV push',
  '血行動力學不穩時的誘導首選。單次使用的腎上腺抑制臨床意義不大。',
  { kg: { lo: 0.3, hi: 0.3, u: 'mg' } });
rx('rsi_ketamine', 'sed', 'Ketamine（RSI 誘導）', 'Ketamine 1.5 mg/kg IV push',
  '低血壓、氣喘重積狀態的誘導選擇。兒茶酚胺耗盡的休克病人仍可能掉血壓。',
  { kg: { lo: 1, hi: 2, u: 'mg' }, ci: '高血壓急症、缺血性心臟病發作中' });
rx('rsi_propofol', 'sed', 'Propofol（RSI 誘導）', 'Propofol 1.5 mg/kg IV push',
  '血壓穩定或偏高（如癲癇重積、高血壓）時。會掉血壓。',
  { kg: { lo: 1.5, hi: 2, u: 'mg' }, ci: '低血壓、休克', adj: { elderly: '1 mg/kg', hf: '✕ 改 Etomidate' } });
rx('rsi_rocuronium', 'sed', 'Rocuronium（RSI 肌鬆）', 'Rocuronium 1 mg/kg IV push',
  '60 秒起效，作用 45–70 分鐘（這段時間看不到抽搐、評估不了神經學）。可用 Sugammadex 16 mg/kg 逆轉。',
  { kg: { lo: 1, hi: 1.2, u: 'mg' }, adj: { hepatic: '作用時間拉長' } });
rx('rsi_succinylcholine', 'sed', 'Succinylcholine（RSI 肌鬆）', 'Succinylcholine 1.5 mg/kg IV push',
  '45 秒起效、作用 6–10 分鐘。',
  { kg: { lo: 1, hi: 1.5, u: 'mg' }, ci: '高血鉀、燒傷或壓砸傷 >48 小時、去神經病變（中風偏癱、脊髓損傷、長期臥床）、惡性高熱病史',
    adj: { r30: '✕ 血鉀偏高或不明時避免，改 Rocuronium', hd: '✕ 血鉀偏高或不明時避免，改 Rocuronium' } });
rx('inf_propofol', 'sed', 'Propofol 持續滴注（插管後）', 'Propofol 1% (10 mg/mL) IVD, start 5 mcg/kg/min, titrate by 5–10 mcg/kg/min q5min to RASS −2 to 0 (usual 5–50 mcg/kg/min)',
  '好調、停了很快醒，方便做神經學評估。先給夠止痛（Fentanyl），再加鎮靜。',
  { kg: { lo: 0.03, hi: 0.3, u: 'mL/h', t: '5–50 mcg/kg/min 的速率（10 mg/mL）' }, mon: '血壓、TG（>48 小時）、propofol infusion syndrome（>4 mg/kg/h 超過 48 小時）', ci: '低血壓未矯正',
    adj: { hf: '掉血壓，低劑量起或改 Midazolam', elderly: '低劑量起' } });
rx('inf_midazolam', 'sed', 'Midazolam 持續滴注（插管後）', 'Midazolam 50 mg in N/S 50 mL (1 mg/mL) IVD, start 0.02 mg/kg/h, titrate to RASS −2 to 0 (usual 0.02–0.1 mg/kg/h)',
  '血壓不穩用不了 Propofol 時。會蓄積、譫妄較多，醒得慢。',
  { kg: { lo: 0.02, hi: 0.1, u: 'mL/h', t: '速率（1 mg/mL）' }, mon: 'RASS q2–4h、每日中斷鎮靜評估',
    adj: { r30: '蓄積，盡量短期、低劑量', hd: '蓄積，盡量短期、低劑量', hepatic: '減量 50%', elderly: '減量、譫妄風險高' } });
rx('inf_fentanyl', 'sed', 'Fentanyl 持續滴注（插管後止痛）', 'Fentanyl 500 mcg in N/S 50 mL (10 mcg/mL) IVD, start 25 mcg/h (2.5 mL/h), titrate to 25–100 mcg/h',
  '插管後先止痛再鎮靜（analgesia-first）。腎功能差也能用。',
  { mon: '疼痛評估（CPOT）、腸蠕動、血壓', adj: { hepatic: '長時間滴注會蓄積', elderly: '低劑量起' } });
rx('inf_dexmed', 'sed', 'Dexmedetomidine（Precedex）', 'Dexmedetomidine 200 mcg in N/S 50 mL (4 mcg/mL) IVD at 0.2–0.7 mcg/kg/h without loading dose',
  '淺鎮靜、可叫醒、不抑制呼吸，譫妄少；適合準備拔管或躁動的病人。深鎮靜做不到。',
  { kg: { lo: 0.05, hi: 0.175, u: 'mL/h', t: '0.2–0.7 mcg/kg/h 的速率（4 mcg/mL）' }, mon: '心跳、血壓', ci: '心搏過緩、二度以上 AV block、低血壓',
    adj: { hepatic: '減量', elderly: '低劑量起、不給 loading' } });

/* ───────── 止痛・退燒 ───────── */
rx('apap_po', 'pain', 'Acetaminophen 口服', 'Acetaminophen 500 mg PO q6h PRN pain or BT >38.5°C (max 4 g per day)',
  '止痛與退燒的第一線。退燒治的是體溫不是病因。',
  { cc: 'pain', max: '一天 ≤4 g；體重 <50 kg、酗酒、營養不良 ≤2–3 g',
    adj: { hepatic: '一天 ≤2 g', r30: '間隔拉長到 q8h', elderly: '一天 ≤3 g' },
    alt: { hepatic: 'Acetaminophen 500 mg PO q6h PRN pain or BT >38.5°C (max 2 g per day)', r30: 'Acetaminophen 500 mg PO q8h PRN pain or BT >38.5°C (max 3 g per day)' } });
rx('apap_iv', 'pain', 'Acetaminophen 靜脈（Acetamol）', 'Acetaminophen 1 g IVD over 15 min q6h PRN pain or fever (body weight <50 kg: 15 mg/kg)',
  '禁食或無法口服時。',
  { cc: 'pain', kg: { lo: 15, hi: 15, u: 'mg', max: 1000, t: '<50 kg 每劑' }, max: '一天 ≤4 g；<50 kg ≤75 mg/kg',
    adj: { hepatic: '一天 ≤2 g', r30: '間隔拉長到 q8h' }, alt: { r30: 'Acetaminophen 1 g IVD over 15 min q8h PRN pain or fever' } });
rx('ketorolac', 'pain', 'Ketorolac（Keto）', 'Ketorolac 30 mg IV q6h PRN pain, for no more than 5 days',
  '腎絞痛、術後痛、骨骼肌肉痛。',
  { cc: 'pain', max: '一天 ≤120 mg（高齡、<50 kg ≤60 mg）；≤5 天', ci: '消化道出血或潰瘍、活動性出血、使用抗凝血劑、aspirin 氣喘',
    adj: { r: '15 mg q6h，並確認不是 AKI', r30: '✕ 禁用', hd: '✕ 還有殘餘腎功能者避免', elderly: '15 mg q6h', hf: '✕ 水鈉滯留，避免', preg: '✕ 20 週後禁用', hepatic: '肝硬化（出血、肝腎症候群風險）避免' },
    alt: { r: 'Ketorolac 15 mg IV q6h PRN pain, for no more than 5 days', elderly: 'Ketorolac 15 mg IV q6h PRN pain, for no more than 5 days' } });
rx('tramadol', 'pain', 'Tramadol', 'Tramadol 50 mg PO/IV q6h PRN moderate pain (max 400 mg per day)',
  '中度疼痛。常見噁心、頭暈。',
  { cc: 'pain', ci: '癲癇病史、併用 SSRI／MAOI／linezolid（serotonin syndrome、降低癲癇閾值）',
    adj: { r30: 'q12h，一天 ≤200 mg', hd: 'q12h，一天 ≤200 mg', hepatic: '50 mg q12h', elderly: '>75 歲一天 ≤300 mg' },
    alt: { r30: 'Tramadol 50 mg PO/IV q12h PRN moderate pain (max 200 mg per day)', hd: 'Tramadol 50 mg PO/IV q12h PRN moderate pain (max 200 mg per day)', hepatic: 'Tramadol 50 mg PO/IV q12h PRN moderate pain (max 100 mg per day)' } });
rx('morphine_iv', 'pain', 'Morphine 靜脈', 'Morphine 2–4 mg IV slow push q4h PRN severe pain',
  '中重度疼痛。同時開軟便劑；備 Naloxone。',
  { cc: 'pain', mon: '呼吸、意識、疼痛分數（給藥後 15–30 分鐘）', ci: '呼吸抑制、腸阻塞',
    adj: { r: '減量 25–50%、拉長間隔', r30: '✕ 活性代謝物蓄積（鎮靜、抽搐），改 Fentanyl', hd: '✕ 改 Fentanyl', elderly: '1–2 mg 起', hepatic: '減量、拉長間隔' },
    alt: { r30: 'Fentanyl 25 mcg IV slow push q1–2h PRN severe pain', hd: 'Fentanyl 25 mcg IV slow push q1–2h PRN severe pain', elderly: 'Morphine 1–2 mg IV slow push q4h PRN severe pain' } });
rx('fentanyl_prn', 'pain', 'Fentanyl 靜脈（PRN）', 'Fentanyl 25–50 mcg IV slow push q1–2h PRN severe pain',
  '腎功能差、血壓偏低時的鴉片類選擇。作用短（30–60 分鐘）。',
  { cc: 'pain', mon: '呼吸、意識', adj: { elderly: '25 mcg 起', hepatic: '重複給會蓄積' } });
rx('sennoside_opioid', 'pain', 'Sennoside（鴉片類的軟便）', 'Sennoside 12 mg 2 tab PO HS',
  '開了鴉片類就一起開，便秘不會產生耐受性。',
  { cc: 'constipation', ci: '腸阻塞' });

/* ───────── 腸胃 ───────── */
rx('ondansetron', 'gi', 'Ondansetron', 'Ondansetron 4 mg IV slow push q8h PRN nausea/vomiting',
  '化療、術後、一般噁心嘔吐。',
  { cc: 'nv', mon: 'QTc、便秘', ci: 'QT 延長、併用其他延長 QT 的藥', adj: { hepatic: '嚴重肝病一天 ≤8 mg' } });
rx('metoclopramide', 'gi', 'Metoclopramide（Primperan）', 'Metoclopramide 10 mg IV slow push q8h PRN nausea/vomiting',
  '胃排空差、偏頭痛合併噁心、打嗝。',
  { cc: 'nv', mon: '錐體外症狀（急性肌張力異常可給 Diphenhydramine 30 mg IV）', ci: '腸阻塞、腸穿孔、消化道出血、Parkinson、pheochromocytoma',
    adj: { r: 'CrCl <40 劑量減半', r30: '5 mg', hd: '5 mg', elderly: '5 mg，EPS 與譫妄風險高' },
    alt: { r30: 'Metoclopramide 5 mg IV slow push q8h PRN nausea/vomiting', hd: 'Metoclopramide 5 mg IV slow push q8h PRN nausea/vomiting', elderly: 'Metoclopramide 5 mg IV slow push q8h PRN nausea/vomiting' } });
rx('prochlorperazine', 'gi', 'Prochlorperazine（Novamin）', 'Prochlorperazine 5 mg IM q8h PRN nausea/vomiting',
  '眩暈合併嘔吐、其他止吐藥無效。',
  { cc: 'nv', mon: '錐體外症狀、低血壓、鎮靜', ci: 'Parkinson、QT 延長', adj: { elderly: '避免或減量（鎮靜、EPS）' } });
rx('ppi_bolus', 'gi', 'Pantoprazole（Pantoloc）高劑量', 'Pantoprazole 80 mg IV bolus over 30 min, then 8 mg/h IVD for 72 h',
  '疑上消化道出血，內視鏡前就開始。內視鏡後若為低風險病灶改 40 mg IV QD–BID。',
  { cc: 'gib', adj: { hepatic: '嚴重肝病一天 ≤20–40 mg', r30: '不需調整' } });
rx('ppi_iv', 'gi', 'Pantoprazole（Pantoloc）一般劑量', 'Pantoprazole 40 mg IV QD',
  '禁食病人的潰瘍預防或治療、胃食道逆流。能口服就改口服。',
  { cc: 'gib', adj: { r30: '不需調整' } });
rx('terlipressin', 'gi', 'Terlipressin（Glypressin）', 'Terlipressin 2 mg IV push q4h until bleeding is controlled, then 1 mg q4h; total 2–5 days',
  '疑食道或胃靜脈瘤出血：內視鏡前就給，同時開預防性抗生素。',
  { cc: 'gib', mon: 'Na（低血鈉）、ECG、腹痛、四肢末梢', ci: '缺血性心臟病、周邊動脈疾病、心律不整；懷孕',
    adj: { preg: '✕ 禁用', elderly: '缺血風險高，改 Octreotide 或 Somatostatin', hf: '缺血與容積負荷，考慮 Octreotide' } });
rx('octreotide', 'gi', 'Octreotide（Sandostatin）', 'Octreotide 50 mcg IV bolus, then 50 mcg/h IVD for 2–5 days',
  '靜脈瘤出血，Terlipressin 有禁忌時。',
  { cc: 'gib', mon: '血糖、心跳' });
rx('ceftriaxone_sbp', 'gi', 'Ceftriaxone（肝硬化出血預防感染）', 'Ceftriaxone 1 g IV q24h for 7 days',
  '肝硬化合併消化道出血：預防性抗生素可降低死亡率。',
  { cc: 'gib', adj: { r30: '不需調整', hd: '不需調整' } });
rx('sennoside', 'gi', 'Sennoside', 'Sennoside 12 mg 2 tab PO HS',
  '刺激性瀉劑，6–12 小時起效。',
  { cc: 'constipation', ci: '腸阻塞、不明原因腹痛' });
rx('mgo_lax', 'gi', 'MgO（軟便）', 'Magnesium oxide 250 mg 2 tab PO TID',
  '滲透性軟便劑，溫和。',
  { cc: 'constipation', adj: { r: '減量並追 Mg', r30: '✕ 高血鎂，改 Lactulose 或 Sennoside', hd: '✕ 高血鎂，改 Lactulose 或 Sennoside' } });
rx('lactulose', 'gi', 'Lactulose', 'Lactulose 20 mL PO BID, titrate to 2–3 soft stools per day',
  '腎功能差的病人首選的滲透性瀉劑；肝性腦病變 30 mL q6–8h。',
  { cc: 'constipation', mon: '脹氣、腹瀉、K', adj: { r30: '首選', hepatic: '首選；腦病變 30 mL q6–8h' } });
rx('bisacodyl_supp', 'gi', 'Bisacodyl 塞劑（Dulcolax）', 'Bisacodyl 10 mg suppository PR once',
  '糞便卡在直腸、口服藥來不及。15–60 分鐘起效。',
  { cc: 'constipation', ci: '腸阻塞、嗜中性球低下或血小板極低（避免肛門給藥）' });
rx('glycerin_enema', 'gi', 'Glycerin 灌腸', 'Glycerin enema 1 pc PR once',
  '先肛診確認不是糞石嵌塞需要挖便。',
  { cc: 'constipation', ci: '嗜中性球低下、血小板極低、近期直腸手術' });
rx('loperamide', 'gi', 'Loperamide（Imodium）', 'Loperamide 4 mg PO once, then 2 mg after each loose stool (max 16 mg per day)',
  '確定不是感染性腹瀉（發燒、血便、近期抗生素要先排除 C. difficile）才用。',
  { cc: 'diarrhea', ci: '血便、高燒、疑 C. difficile 或毒性巨結腸', adj: { hepatic: '減量', elderly: '注意腸阻塞' } });
rx('smecta', 'gi', 'Dioctahedral smectite（Smecta）', 'Dioctahedral smectite 3 g PO TID',
  '吸附性止瀉，安全。與其他口服藥間隔 2 小時。',
  { cc: 'diarrhea' });
rx('vanco_po', 'gi', 'Vancomycin 口服（C. difficile）', 'Vancomycin 125 mg PO QID for 10 days',
  'C. difficile 感染的初次發作。猛爆性（低血壓、ileus、巨結腸）：500 mg PO QID＋Metronidazole 500 mg IV q8h。',
  { cc: 'diarrhea', mon: '排便次數、腹脹、WBC、Cr', adj: { r30: '口服幾乎不吸收，不需調整' } });
rx('buscopan', 'gi', 'Hyoscine butylbromide（Buscopan）', 'Hyoscine butylbromide 20 mg IV/IM q8h PRN colicky abdominal pain',
  '腸絞痛、膽絞痛、腎絞痛。先排除外科急腹症再止痛。',
  { cc: 'abdpain', ci: '青光眼、攝護腺肥大尿滯留、腸阻塞、心搏過速、重症肌無力', adj: { elderly: '尿滯留、譫妄、心跳快，盡量避免' } });
rx('baclofen_hiccup', 'gi', 'Baclofen（頑固性打嗝）', 'Baclofen 5 mg PO TID',
  '打嗝超過 48 小時、Metoclopramide 無效時。',
  { cc: 'hiccup', mon: '嗜睡、無力', adj: { r: '5 mg BID', r30: '✕ 蓄積會意識不清，避免', hd: '✕ 禁用（腦病變）', elderly: '5 mg BID，跌倒風險' },
    alt: { r: 'Baclofen 5 mg PO BID' } });
rx('chlorpromazine_hiccup', 'gi', 'Chlorpromazine（Wintermin）', 'Chlorpromazine 25 mg PO TID PRN hiccups',
  '唯一有打嗝適應症的藥。會低血壓、鎮靜。',
  { cc: 'hiccup', mon: '血壓、QTc', adj: { elderly: '12.5 mg 起，注意姿勢性低血壓與譫妄', hepatic: '減量' } });

/* ───────── 血糖 ───────── */
rx('d50', 'endo', '50% Glucose', '50% glucose 40 mL (20 g) IV push; recheck finger sugar in 15 min, repeat if <70 mg/dL',
  '低血糖合併意識不清或不能口服。50% glucose 20 mL/支，給 2 支。',
  { cc: 'hypoglycemia', mon: '15 分鐘後血糖，之後 q1h 到穩定；注射部位（高張、外滲會壞死）' });
rx('glucose_po', 'endo', '口服葡萄糖', 'Glucose 15–20 g PO (e.g. 150 mL juice or 3–4 glucose tablets); recheck finger sugar in 15 min, repeat if <70 mg/dL',
  '清醒、能吞的低血糖。15 分鐘原則：吃 15 g、等 15 分鐘、再驗。回到 >70 後吃一份正餐或點心。',
  { cc: 'hypoglycemia' });
rx('glucagon', 'endo', 'Glucagon', 'Glucagon 1 mg IM/SC once',
  '沒有 IV、不能口服時。10–15 分鐘起效；肝醣耗盡（酗酒、肝硬化、長期禁食）會無效。',
  { cc: 'hypoglycemia', mon: '醒來後常會吐，側躺', adj: { hepatic: '可能無效，盡快建立 IV 給糖' } });
rx('d10_drip', 'endo', 'D10W 持續滴注', 'D10W IVD at 80 mL/h; finger sugar q1h until stable >100 mg/dL, then q4h',
  '反覆低血糖、磺醯尿素類或長效胰島素造成（作用可長達 24–72 小時）。',
  { cc: 'hypoglycemia', mon: '血糖 q1h、Na', adj: { hf: '改 D20W 40 mL/h 走中央靜脈，減少水量', r30: '磺醯尿素類蓄積，低血糖會拖很久，至少觀察 24–48 小時', hd: '同左，並限制輸液量' } });
rx('ri_sc_corr', 'endo', 'Regular insulin 校正劑量', 'Regular insulin SC with each finger sugar check (QID AC and HS, or q6h if NPO) per sliding scale: 200–249: 2 U, 250–299: 4 U, 300–349: 6 U, 350–399: 8 U, ≥400: 10 U and notify',
  '沒有急症的高血糖。睡前劑量減半。單靠 sliding scale 不夠，隔天要調 basal。',
  { cc: 'hyperglycemia', mon: '2–4 小時後複驗血糖',
    adj: { r: '每一階減 2 U', r30: '每一階減半（胰島素清除變慢）', hd: '每一階減半', elderly: '每一階減 2 U，寧高勿低' },
    alt: { r30: 'Regular insulin SC with each finger sugar check (QID AC and HS, or q6h if NPO) per reduced sliding scale: 250–299: 2 U, 300–349: 3 U, 350–399: 4 U, ≥400: 5 U and notify', hd: 'Regular insulin SC with each finger sugar check (QID AC and HS, or q6h if NPO) per reduced sliding scale: 250–299: 2 U, 300–349: 3 U, 350–399: 4 U, ≥400: 5 U and notify' } });
rx('ri_drip_dka', 'endo', 'Regular insulin 滴注（DKA／HHS）', 'Regular insulin 50 U in N/S 50 mL (1 U/mL), 0.1 U/kg/h IVD; finger sugar q1h; when glucose <250 mg/dL, add D5W and reduce to 0.02–0.05 U/kg/h',
  '先確認 K ≥3.3 才開始胰島素（<3.3 先以 10 mEq/h 補鉀；ADA／EASD 2024 把門檻訂在 3.5）。目標每小時降 50–70 mg/dL。HHS 從 0.05 U/kg/h 起。',
  { cc: 'hyperglycemia', kg: { lo: 0.1, hi: 0.1, u: 'U/h' }, mon: '血糖 q1h；K、HCO3、anion gap q2–4h', adj: { r30: '速率減半起（0.05 U/kg/h）', hd: '速率減半起；輸液量要保守' } });
rx('ns_dka', 'endo', 'N/S 補液（DKA／HHS）', 'N/S 1000 mL IVD over the first hour, then 250–500 mL/h according to hemodynamics and corrected Na',
  'DKA／HHS 第一步是補水。校正鈉正常或偏高後改 0.45% NaCl。K <5.3 且有尿就在每升輸液加 KCl 20–30 mEq，目標 4–5。',
  { cc: 'hyperglycemia', mon: 'I/O、K q2–4h、肺部聽診', adj: { hf: '250–500 mL 分次給、頻繁評估', r30: '速率減半、頻繁評估', hd: '無尿者只需少量輸液，以胰島素為主' },
    alt: { hf: 'N/S 500 mL IVD over the first hour, then reassess volume status before further fluids', hd: 'N/S 250 mL IVD over the first hour, then reassess volume status before further fluids' } });

/* ───────── 過敏・輸血反應 ───────── */
rx('diphenhydramine', 'allergy', 'Diphenhydramine（Vena）', 'Diphenhydramine 30 mg IV/IM once',
  '蕁麻疹、搔癢、輕度過敏或輸血反應。只治皮膚症狀，不能取代 Epinephrine。',
  { cc: 'allergy', mon: '鎮靜、尿滯留', adj: { elderly: '譫妄、尿滯留、跌倒，改第二代抗組織胺', hepatic: '減量' } });
rx('levocetirizine', 'allergy', 'Levocetirizine（Xyzal）', 'Levocetirizine 5 mg PO HS',
  '搔癢、蕁麻疹、藥物疹的口服首選，不太嗜睡。',
  { cc: 'allergy', adj: { r: '5 mg QOD', r30: '5 mg 每 3 天一次', hd: '✕ 禁用，改 Fexofenadine 或 Loratadine' }, alt: { r: 'Levocetirizine 5 mg PO QOD HS', r30: 'Levocetirizine 5 mg PO every 3 days HS' } });
rx('methylpred_allergy', 'allergy', 'Methylprednisolone', 'Methylprednisolone 40 mg IV once',
  '嚴重過敏的輔助治療（起效要數小時，不是第一線），或廣泛性藥物疹。',
  { cc: 'allergy', mon: '血糖' });
rx('famotidine_iv', 'allergy', 'Famotidine IV', 'Famotidine 20 mg IV once',
  '過敏性休克的輔助（H2 blocker）。',
  { cc: 'allergy', adj: { r: 'CrCl <50 劑量減半', r30: '10 mg', hd: '10 mg', elderly: '注意譫妄' }, alt: { r30: 'Famotidine 10 mg IV once', hd: 'Famotidine 10 mg IV once' } });
rx('furosemide_taco', 'allergy', 'Furosemide（輸血造成的容積過多）', 'Furosemide 20–40 mg IV push once',
  'TACO：輸血中或輸完 6 小時內喘、血壓高、頸靜脈怒張。先停輸血、坐起、給氧。',
  { cc: 'txrxn', mon: '尿量、SpO2', adj: { r30: '40–80 mg', hd: '無尿者安排透析 UF' } });

/* ───────── 出血・輸血・抗凝 ───────── */
rx('prbc', 'heme', 'pRBC 輸血', 'Leukoreduced pRBC 2 U IV transfusion, each unit over 2–3 h; recheck Hb 1 h after transfusion',
  'Hb <7 g/dL（心血管疾病、骨科術後 <8；ACS <8–10）。沒有在出血的病人一次輸 1 U 再評估。一單位約升 1 g/dL。',
  { cc: 'anemia', mon: '輸血前、開始 15 分鐘、結束時量 vital signs', max: '每單位 4 小時內輸完',
    adj: { hf: '一次 1 U、每單位 3–4 小時，兩袋之間給 Furosemide 20 mg IV', r30: '一次 1 U，注意 overload 與高血鉀', hd: '盡量安排在透析中輸；注意高血鉀', elderly: '一次 1 U、慢輸' },
    alt: { hf: 'Leukoreduced pRBC 1 U IV transfusion over 3–4 h, furosemide 20 mg IV after the unit; recheck Hb 1 h after transfusion', r30: 'Leukoreduced pRBC 1 U IV transfusion over 3 h; recheck Hb and K after transfusion', hd: 'Leukoreduced pRBC 1 U IV transfusion over 3 h (during dialysis if possible); recheck Hb and K after transfusion' } });
rx('plt', 'heme', '血小板輸注', 'Apheresis platelets 1 U (= 12 U random-donor) IV transfusion over 30–60 min; recheck platelet count 1 h after transfusion',
  '門檻：<10k 預防性；<20k 合併發燒或感染；<50k 活動性出血或要做侵入性處置；<100k 神經外科或眼科手術。',
  { cc: 'coag', ci: 'TTP、HIT 原則上不輸（會惡化血栓），除非危及生命的出血' });
rx('ffp', 'heme', 'FFP', 'FFP 10–15 mL/kg (about 4 U) IVD, each unit over 30–60 min; recheck PT/INR after transfusion',
  'INR >1.5 合併活動性出血或要做侵入性處置。只為了矯正數字不用輸。',
  { cc: 'coag', kg: { lo: 10, hi: 15, u: 'mL' }, mon: '容積過多（TACO）、過敏', adj: { hf: '容積大（約 800–1000 mL），慢輸並給利尿劑；Warfarin 相關出血改 PCC' } });
rx('vitk_iv', 'heme', 'Vitamin K1 靜脈', 'Vitamin K1 10 mg in N/S 50 mL IVD over 30 min once',
  'Warfarin 相關的嚴重出血（同時給 PCC 或 FFP）。6–12 小時才開始有效。',
  { cc: 'coag', mon: 'INR 6–12 小時後', ci: '快速推注可能過敏性休克，要慢滴' });
rx('vitk_po', 'heme', 'Vitamin K1 口服', 'Vitamin K1 2.5 mg PO once; recheck INR in 24 h',
  'INR >10 沒有出血。INR 4.5–10 沒有出血：停 1–2 劑 Warfarin 即可，不需要 vitamin K。',
  { cc: 'coag' });
rx('txa_bleed', 'heme', 'Tranexamic acid（出血）', 'Tranexamic acid 1 g in N/S 100 mL IVD over 10 min once',
  '創傷、術後、黏膜出血的輔助。消化道出血沒有好處（HALT-IT），不建議常規使用。',
  { cc: 'wound', ci: '活動性血栓、肉眼血尿、蜘蛛膜下腔出血', adj: { r: '後續劑量減半', r30: '只給一劑，蓄積會抽搐', hd: '只給一劑' } });
rx('protamine', 'heme', 'Protamine', 'Protamine 1 mg per 100 U heparin given in the last 2–3 h (max 50 mg) IV slow push over 10 min',
  'Heparin 相關的嚴重出血。Enoxaparin 8 小時內：每 1 mg 給 1 mg（只能逆轉約 60%）。',
  { cc: 'coag', mon: '血壓、過敏（魚類過敏、用過 NPH insulin 者風險高）' });

/* ───────── 抗生素 ───────── */
rx('ceftriaxone', 'abx', 'Ceftriaxone（Rocephin）', 'Ceftriaxone 2 g IV q24h',
  '社區型肺炎、泌尿道感染、腹內感染（加 Metronidazole）。腦膜炎 2 g q12h。',
  { cc: 'fever', ci: '不可與含鈣輸液同一條線', adj: { r30: '不需調整', hd: '不需調整', hepatic: '合併嚴重肝腎功能不全時一天 ≤2 g' } });
rx('cefepime', 'abx', 'Cefepime（Maxipime）', 'Cefepime 2 g IV q8h',
  '院內感染、febrile neutropenia、要蓋 Pseudomonas 時。',
  { cc: 'fever', mon: '意識（腎差時的神經毒性：譫妄、肌躍動、非抽搐性癲癇）',
    adj: { r: 'CrCl 30–60：2 g q12h', r30: 'CrCl 11–29：2 g q24h；<11：1 g q24h', hd: '1 g q24h，透析日透析後給', elderly: '用 CrCl 算，不要只看 Cr' },
    alt: { r: 'Cefepime 2 g IV q12h', r30: 'Cefepime 2 g IV q24h', hd: 'Cefepime 1 g IV q24h (after dialysis on dialysis days)' } });
rx('piptazo', 'abx', 'Piperacillin-tazobactam（Tazocin）', 'Piperacillin-tazobactam 4.5 g IV q6h',
  '院內肺炎、腹內感染、要蓋 Pseudomonas 與厭氧菌。',
  { cc: 'fever', mon: 'Cr、K、血小板',
    adj: { r: 'CrCl 20–40：3.375 g q6h', r30: 'CrCl <20：2.25 g q6h', hd: '2.25 g q8h，透析後補 0.75 g' },
    alt: { r: 'Piperacillin-tazobactam 3.375 g IV q6h', r30: 'Piperacillin-tazobactam 2.25 g IV q6h', hd: 'Piperacillin-tazobactam 2.25 g IV q8h (supplement 0.75 g after dialysis)' } });
rx('meropenem', 'abx', 'Meropenem（Mepem）', 'Meropenem 1 g IV q8h',
  'ESBL、嚴重院內感染。會讓 Valproate 濃度掉到無效。',
  { cc: 'fever', mon: '抽搐（腎差、中樞病變）',
    adj: { r: 'CrCl 26–50：1 g q12h', r30: 'CrCl 10–25：0.5 g q12h；<10：0.5 g q24h', hd: '0.5 g q24h，透析日透析後給' },
    alt: { r: 'Meropenem 1 g IV q12h', r30: 'Meropenem 0.5 g IV q12h', hd: 'Meropenem 0.5 g IV q24h (after dialysis on dialysis days)' } });
rx('vancomycin', 'abx', 'Vancomycin', 'Vancomycin 25 mg/kg IV loading dose (max 3 g, infuse ≤1 g/h), then 15 mg/kg IV q12h; check level before the 4th dose',
  'MRSA、CRBSI、嚴重皮膚軟組織感染。負荷劑量不因腎功能減少。',
  { cc: 'fever', kg: { lo: 25, hi: 25, u: 'mg', max: 3000, t: '負荷劑量' }, mon: 'Cr 每 2–3 天、trough 或 AUC；滴太快會 red man syndrome',
    adj: { r: '負荷照給；維持 15 mg/kg q24h，看濃度', r30: '負荷照給；之後看濃度（<15–20 mcg/mL）再給下一劑', hd: '負荷照給；之後透析前濃度 <20 才補 500–1000 mg（透析後給）', elderly: '維持劑量間隔拉長' },
    alt: { r: 'Vancomycin 25 mg/kg IV loading dose (max 3 g, infuse ≤1 g/h), then 15 mg/kg IV q24h; check level before the 3rd dose', r30: 'Vancomycin 25 mg/kg IV loading dose (max 3 g, infuse ≤1 g/h) once; redose by level', hd: 'Vancomycin 25 mg/kg IV loading dose (max 3 g, infuse ≤1 g/h) once; redose after dialysis by pre-dialysis level' } });
rx('levofloxacin', 'abx', 'Levofloxacin（Cravit）', 'Levofloxacin 750 mg IV/PO QD',
  '肺炎（含非典型）、複雜性泌尿道感染。結核還沒排除前小心使用（會掩蓋並造成抗藥）。',
  { cc: 'fever', mon: 'QTc、血糖、肌腱痛、譫妄', ci: 'QT 延長、重症肌無力、主動脈瘤',
    adj: { r: 'CrCl 20–49：750 mg q48h', r30: 'CrCl <20：750 mg 一次，之後 500 mg q48h', hd: '750 mg 一次，之後 500 mg q48h', elderly: '譫妄、肌腱斷裂、低血糖風險', preg: '✕ 避免' },
    alt: { r: 'Levofloxacin 750 mg IV/PO q48h', r30: 'Levofloxacin 750 mg IV/PO once, then 500 mg q48h', hd: 'Levofloxacin 750 mg IV/PO once, then 500 mg q48h' } });
rx('augmentin_iv', 'abx', 'Amoxicillin-clavulanate（Augmentin）IV', 'Amoxicillin-clavulanate 1.2 g IV q8h',
  '吸入性肺炎、社區型腹內或皮膚軟組織感染。',
  { cc: 'fever', mon: '肝指數、腹瀉',
    adj: { r30: 'CrCl 10–30：首劑 1.2 g，之後 600 mg q12h；<10：600 mg q24h', hd: '首劑 1.2 g，之後 600 mg q24h，透析後加 600 mg' },
    alt: { r30: 'Amoxicillin-clavulanate 1.2 g IV once, then 600 mg IV q12h', hd: 'Amoxicillin-clavulanate 1.2 g IV once, then 600 mg IV q24h (extra 600 mg after dialysis)' } });
rx('unasyn', 'abx', 'Ampicillin-sulbactam（Unasyn）', 'Ampicillin-sulbactam 3 g IV q6h',
  '吸入性肺炎、頭頸部感染、糖尿病足。',
  { cc: 'fever', adj: { r: 'CrCl ≥30 不需調整', r30: 'CrCl 15–29：3 g q12h；5–14：3 g q24h', hd: '3 g q24h，透析日透析後給' },
    alt: { r30: 'Ampicillin-sulbactam 3 g IV q12h', hd: 'Ampicillin-sulbactam 3 g IV q24h (after dialysis on dialysis days)' } });
rx('cefazolin', 'abx', 'Cefazolin', 'Cefazolin 2 g IV q8h',
  'MSSA 菌血症、蜂窩性組織炎。',
  { cc: 'fever', adj: { r: 'CrCl 35–54：2 g q8h 不變', r30: 'CrCl 11–34：1 g q12h；≤10：1 g q24h', hd: '透析後 2 g（每週三次）或 1 g q24h' },
    alt: { r30: 'Cefazolin 1 g IV q12h', hd: 'Cefazolin 2 g IV after each dialysis session' } });
rx('metronidazole', 'abx', 'Metronidazole', 'Metronidazole 500 mg IV q8h',
  '厭氧菌（腹內感染搭配 Ceftriaxone）、猛爆性 C. difficile 的輔助。',
  { cc: 'fever', ci: '與酒精併用（disulfiram 反應）；Warfarin 會 INR 上升', adj: { hepatic: 'Child-Pugh C：500 mg q12h', r30: '不需調整', hd: '透析日透析後給' }, alt: { hepatic: 'Metronidazole 500 mg IV q12h' } });
rx('oseltamivir', 'abx', 'Oseltamivir（Tamiflu）', 'Oseltamivir 75 mg PO BID for 5 days',
  '流感：住院病人不論發病幾天都給。',
  { cc: 'fever', adj: { r: 'CrCl 30–60：30 mg BID', r30: 'CrCl 10–30：30 mg QD', hd: '每次透析後 30 mg' },
    alt: { r: 'Oseltamivir 30 mg PO BID for 5 days', r30: 'Oseltamivir 30 mg PO QD for 5 days', hd: 'Oseltamivir 30 mg PO after each dialysis session' } });

/* ───────── 依病人條件算出這張醫囑 ─────────
   st: { rn: '' | 'r' | 'r30' | 'hd', hepatic, hf, elderly, preg, wt }
   回傳 { o 醫囑文字, changed 是否換成調整後的醫囑, x 禁用且沒有替代醫囑, notes [[狀態 key, 文字, 是否禁用]], kg 體重換算文字 } */
const RX_RENAL = { r: ['r'], r30: ['r30', 'r'], hd: ['hd', 'r30', 'r'] };
function rxStates(st) {
  const a = [];
  if (st && RX_RENAL[st.rn]) a.push(st.rn);
  ['preg', 'hepatic', 'hf', 'elderly'].forEach(k => { if (st && st[k]) a.push(k); });
  return a;
}
function rxNum(v) { return v >= 100 ? String(Math.round(v / 5) * 5) : v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10); }
function rxKg(x, wt) {
  const w = parseFloat(String(wt == null ? '' : wt).replace(',', '.')), k = x.kg;   // 有些 Android 鍵盤的小數點是逗號
  if (!k || !isFinite(w) || w < 20 || w > 250) return '';
  const cap = v => k.max ? Math.min(v, k.max) : v;
  const lo = cap(k.lo * w), hi = cap(k.hi * w);
  return `${w} kg → ${k.t ? k.t + ' ' : ''}${lo === hi ? rxNum(lo) : rxNum(lo) + '–' + rxNum(hi)} ${k.u}${k.max && hi >= k.max ? '（已達上限）' : ''}`;
}
function rxEval(id, st) {
  const x = RX[id]; if (!x) return null;
  const adj = x.adj || {}, alt = x.alt || {}, notes = [];
  let o = x.o, changed = false, bad = false;
  rxStates(st).forEach(k => {
    const lv = (RX_RENAL[k] || [k]).find(l => adj[l] || alt[l]);
    if (!lv) return;
    const isX = !!adj[lv] && adj[lv].startsWith('✕');
    if (adj[lv]) notes.push([k, adj[lv].replace(/^✕\s*/, ''), isX]);
    if (isX) bad = true;
    if (alt[lv] && !changed) { o = alt[lv]; changed = true; }
  });
  return { o, changed, x: bad && !changed, notes, kg: rxKg(x, st && st.wt) };
}
