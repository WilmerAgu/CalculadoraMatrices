const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX = 6;
let mats = [];
let lastResult = null;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ---------- Números ----------
function parseVal(raw){
  let s = String(raw).trim().replace(/\u2212/g,'-').replace(/,/g,'.');
  if (s === '') return 0;
  const n = /^[-+]?(\d+\.?\d*|\.\d+)$/;
  if (s.includes('/')){
    const [a,b] = s.split('/');
    if (!n.test(a.trim()) || !n.test(b.trim())) return NaN;
    const den = Number(b);
    return den === 0 ? NaN : Number(a) / den;
  }
  return n.test(s) ? Number(s) : NaN;
}
function f(x){
  let r = Math.round(x * 1e6) / 1e6;
  if (Math.abs(r) < 1e-12) r = 0;
  return String(r).replace('-', '\u2212');
}
const p = x => (Math.round(x*1e6)/1e6 < 0 ? `(${f(x)})` : f(x));

// ---------- Matrices ----------
function newName(){ for (const l of LETTERS) if (!mats.some(m => m.name === l)) return l; return null; }
function addMatrix(rows=2, cols=2, data=null){
  const name = newName(); if (!name) return null;
  const m = { name, rows, cols, data: data || Array.from({length:rows}, () => Array(cols).fill('')), detHtml:null };
  mats.push(m); return m;
}
const find = name => mats.find(m => m.name === name);

function resize(m, rows, cols){
  m.data = Array.from({length:rows}, (_, i) => Array.from({length:cols}, (_, j) => (m.data[i] && m.data[i][j] !== undefined) ? m.data[i][j] : ''));
  m.rows = rows; m.cols = cols; m.detHtml = null;
}

// Lee la matriz y marca celdas inválidas
function readMatrix(m){
  const vals = [], bad = [];
  for (let i = 0; i < m.rows; i++){
    vals.push([]);
    for (let j = 0; j < m.cols; j++){
      const v = parseVal(m.data[i][j]);
      if (Number.isNaN(v)) bad.push([i,j]);
      vals[i].push(v);
    }
  }
  const panel = $('mat-' + m.name);
  if (panel){
    panel.querySelectorAll('.cell').forEach(c => c.classList.remove('bad'));
    bad.forEach(([i,j]) => { const c = panel.querySelector(`.cell[data-r="${i}"][data-c="${j}"]`); if (c) c.classList.add('bad'); });
  }
  return { vals, bad };
}
const badMsg = (m, bad) => {
  const [i,j] = bad[0];
  return `Revisa la matriz ${m.name}, fila ${i+1}, columna ${j+1}: escribe un número como 4, −2,5 o 1/3.`;
};

// ---------- Determinante con procedimiento ----------
function detSteps(A){
  const n = A.length;
  if (n === 1){
    return { html:`<div class="steps">det = <b>${f(A[0][0])}</b></div><p class="note">En una matriz 1×1 el determinante es el mismo número.</p>` };
  }
  if (n === 2){
    const [a,b] = A[0], [c,d] = A[1];
    const v = a*d - b*c;
    return { html:`<div class="steps">det = ${p(a)}·${p(d)} − ${p(b)}·${p(c)}<br>= ${f(a*d)} − ${p(b*c)} = <b>${f(v)}</b></div><p class="note">Diagonal principal menos diagonal secundaria.</p>` };
  }
  if (n === 3){
    const [[a,b,c],[d,e,g],[h,i,k]] = A;
    const m1 = e*k - g*i, m2 = d*k - g*h, m3 = d*i - e*h;
    const t1 = a*m1, t2 = b*m2, t3 = c*m3;
    const v = t1 - t2 + t3;
    return { html:`<div class="steps">
      det = ${p(a)}·(${p(e)}·${p(k)} − ${p(g)}·${p(i)}) − ${p(b)}·(${p(d)}·${p(k)} − ${p(g)}·${p(h)}) + ${p(c)}·(${p(d)}·${p(i)} − ${p(e)}·${p(h)})<br>
      = ${p(a)}·${p(m1)} − ${p(b)}·${p(m2)} + ${p(c)}·${p(m3)}<br>
      = ${f(t1)} − ${p(t2)} + ${p(t3)} = <b>${f(v)}</b></div>
      <p class="note">Desarrollo por cofactores sobre la primera fila.</p>` };
  }
  // n >= 4: eliminación de Gauss con pivoteo parcial
  const M = A.map(r => r.slice());
  let swaps = 0;
  for (let k = 0; k < n; k++){
    let piv = k;
    for (let r = k+1; r < n; r++) if (Math.abs(M[r][k]) > Math.abs(M[piv][k])) piv = r;
    if (Math.abs(M[piv][k]) < 1e-12){
      return { html:`<div class="steps">det = <b>0</b></div><p class="note">Al triangular por eliminación de Gauss quedó una columna sin pivote, así que el determinante es 0.</p>` };
    }
    if (piv !== k){ [M[piv], M[k]] = [M[k], M[piv]]; swaps++; }
    for (let r = k+1; r < n; r++){
      const fac = M[r][k] / M[k][k];
      for (let c = k; c < n; c++) M[r][c] -= fac * M[k][c];
    }
  }
  const diag = M.map((r, i) => r[i]);
  let v = diag.reduce((acc, x) => acc * x, 1);
  if (swaps % 2) v = -v;
  const signo = swaps % 2 ? '−' : '';
  return { html:`<div class="steps">det = ${signo}(${diag.map(p).join(' · ')}) = <b>${f(v)}</b></div>
    <p class="note">Eliminación de Gauss: se lleva la matriz a forma triangular y se multiplican los números de la diagonal. ${swaps ? `Hubo ${swaps} intercambio${swaps>1?'s':''} de filas; cada uno cambia el signo.` : 'No hizo falta intercambiar filas.'}</p>` };
}

// ---------- Vistas ----------
function sizeSelect(kind, val, name){
  let o = '';
  for (let i = 1; i <= MAX; i++) o += `<option value="${i}"${i===val?' selected':''}>${i}</option>`;
  return `<select data-kind="${kind}" data-name="${name}" aria-label="${kind==='rows'?'Filas':'Columnas'} de ${name}">${o}</select>`;
}
function panelHtml(m){
  let cells = '';
  for (let i = 0; i < m.rows; i++)
    for (let j = 0; j < m.cols; j++)
      cells += `<input class="cell" inputmode="decimal" placeholder="0" data-name="${m.name}" data-r="${i}" data-c="${j}" value="${esc(m.data[i][j])}" aria-label="${m.name} fila ${i+1} columna ${j+1}">`;
  const square = m.rows === m.cols;
  let det = '';
  if (m.detHtml) det = `<div class="det flash">${m.detHtml}</div>`;
  else if (!square) det = `<div class="det"><p class="note">Solo las matrices cuadradas tienen determinante. Esta es ${m.rows}×${m.cols}.</p></div>`;
  return `<div class="mat" id="mat-${m.name}">
    <div class="mat-head">
      <span class="mat-name">${m.name}</span>
      <span class="size">${sizeSelect('rows', m.rows, m.name)} × ${sizeSelect('cols', m.cols, m.name)}</span>
    </div>
    <div class="scroll"><div class="bracket" style="grid-template-columns:repeat(${m.cols}, auto)">${cells}</div></div>
    <div class="actions">
      <button class="primary" data-action="det" data-name="${m.name}"${square?'':' disabled'}>Determinante</button>
      <button data-action="rand" data-name="${m.name}">Aleatoria</button>
      <button data-action="clear" data-name="${m.name}">Limpiar</button>
      <button class="danger" data-action="del" data-name="${m.name}">Eliminar</button>
    </div>
    ${det}
  </div>`;
}
function viewMatrix(vals, name, isResult){
  const cols = vals[0].length;
  const nums = vals.flat().map(x => `<span class="num">${f(x)}</span>`).join('');
  return `<span class="${isResult?'result':''}" style="display:inline-flex;align-items:center;flex:none">
    ${name ? `<span class="vname">${name}</span>` : ''}
    <span class="bracket" style="grid-template-columns:repeat(${cols}, auto)">${nums}</span></span>`;
}

function render(){
  const box = $('matrices');
  box.innerHTML = mats.map(panelHtml).join('') +
    `<button class="add" id="btnAdd"${newName()?'':' disabled'}>+ Agregar matriz</button>`;
  // refrescar selects de operación
  ['selX','selY'].forEach((id, k) => {
    const sel = $(id), prev = sel.value;
    sel.innerHTML = mats.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    if (find(prev)) sel.value = prev;
    else if (mats[k]) sel.value = mats[k].name;
  });
  $('btnCalc').disabled = mats.length === 0;
}

// ---------- Eventos ----------
$('matrices').addEventListener('input', e => {
  const c = e.target.closest('.cell'); if (!c) return;
  const m = find(c.dataset.name);
  m.data[+c.dataset.r][+c.dataset.c] = c.value;
  c.classList.remove('bad');
  if (m.detHtml){ m.detHtml = null; const d = $('mat-'+m.name).querySelector('.det'); if (d) d.remove(); }
});
$('matrices').addEventListener('change', e => {
  const s = e.target.closest('select'); if (!s) return;
  const m = find(s.dataset.name);
  if (s.dataset.kind === 'rows') resize(m, +s.value, m.cols); else resize(m, m.rows, +s.value);
  render();
});
$('matrices').addEventListener('click', e => {
  if (e.target.id === 'btnAdd'){
    const m = addMatrix(2, 2); render();
    if (m) $('mat-'+m.name).querySelector('.cell').focus();
    return;
  }
  const b = e.target.closest('button[data-action]'); if (!b) return;
  const m = find(b.dataset.name);
  switch (b.dataset.action){
    case 'det': {
      const { vals, bad } = readMatrix(m);
      m.detHtml = bad.length ? `<p class="err">${badMsg(m, bad)}</p>` : detSteps(vals).html;
      const panel = $('mat-'+m.name);
      const old = panel.querySelector('.det'); if (old) old.remove();
      panel.insertAdjacentHTML('beforeend', `<div class="det flash">${m.detHtml}</div>`);
      if (bad.length) m.detHtml = null;
      break;
    }
    case 'rand':
      m.data = m.data.map(r => r.map(() => String(Math.floor(Math.random()*19) - 9)));
      m.detHtml = null; render(); break;
    case 'clear':
      m.data = m.data.map(r => r.map(() => '')); m.detHtml = null; render(); break;
    case 'del':
      mats = mats.filter(x => x !== m); render(); break;
  }
});

$('btnCalc').addEventListener('click', () => {
  const out = $('opOut');
  const X = find($('selX').value), Y = find($('selY').value), op = $('selOp').value;
  lastResult = null;
  if (!X || !Y){ out.innerHTML = `<p class="err">Agrega al menos una matriz para poder operar.</p>`; return; }
  if (X.rows !== Y.rows || X.cols !== Y.cols){
    out.innerHTML = `<p class="err">No se puede: ${X.name} es ${X.rows}×${X.cols} y ${Y.name} es ${Y.rows}×${Y.cols}. Para sumar o restar, las dos matrices deben tener el mismo tamaño.</p>`;
    return;
  }
  const a = readMatrix(X), b = readMatrix(Y);
  if (a.bad.length){ out.innerHTML = `<p class="err">${badMsg(X, a.bad)}</p>`; return; }
  if (b.bad.length){ out.innerHTML = `<p class="err">${badMsg(Y, b.bad)}</p>`; return; }
  const R = a.vals.map((row, i) => row.map((v, j) => op === '+' ? v + b.vals[i][j] : v - b.vals[i][j]));
  lastResult = R;
  out.innerHTML = `<div class="equation flash">
      ${viewMatrix(a.vals, X.name)}<span class="sym">${op === '+' ? '+' : '−'}</span>${viewMatrix(b.vals, Y.name)}
      <span class="sym">=</span>${viewMatrix(R, '', true)}
    </div>
    <p class="note">Se ${op === '+' ? 'suma' : 'resta'} cada posición con la que está en el mismo lugar de la otra matriz.</p>
    <button class="save" id="btnSave"${newName()?'':' disabled'}>Guardar resultado como matriz nueva</button>`;
});
$('opOut').addEventListener('click', e => {
  if (e.target.id !== 'btnSave' || !lastResult) return;
  const data = lastResult.map(r => r.map(x => f(x).replace('\u2212','-')));
  const m = addMatrix(lastResult.length, lastResult[0].length, data);
  render();
  if (m){
    e.target.textContent = `Guardada como ${m.name}`; e.target.disabled = true;
    $('mat-'+m.name).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center' });
  }
});

// Ejemplo inicial para que se vea funcionando
addMatrix(2, 2, [['2','1'],['3','4']]);
addMatrix(2, 2, [['1','-1'],['0','5']]);
render();
