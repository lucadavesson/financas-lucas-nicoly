const C = require('/tmp/pc/parcelasCore.js')
let ok=0, fail=0
const eq=(n,a,b)=>{const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){ok++;console.log(`  ok  ${n}`)}else{fail++;console.log(`  FALHA ${n}\n   esperado ${B}\n   recebido ${A}`)}}

console.log('\n— soma de meses tem que bater com o addMonths do date-fns —')
eq('mes cheio',        C.somaMesesData('2025-10-15', 11), '2026-09-15')
eq('vira o ano',       C.somaMesesData('2025-11-15', 12), '2026-11-15')
eq('31/01 + 1 = 28/02',C.somaMesesData('2026-01-31', 1),  '2026-02-28')
eq('31/01 + 1 bissexto',C.somaMesesData('2028-01-31', 1), '2028-02-29')
eq('31/03 + 1 = 30/04',C.somaMesesData('2026-03-31', 1),  '2026-04-30')
eq('recua',            C.somaMesesData('2026-09-15', -11),'2025-10-15')
eq('recua virando ano',C.somaMesesData('2026-01-10', -1), '2025-12-10')
eq('mesesEntre',       C.mesesEntre('2025-10-15','2026-09-15'), 11)

// Confere contra o date-fns de verdade, que é o que o app usa para gerar
const { addMonths, parseISO, format } = require('/sessions/exciting-magical-wozniak/financas-lucas-nicoly/node_modules/date-fns')
console.log('\n— mesmo resultado do date-fns em 500 combinações —')
let div=0
for (const d of ['2025-01-31','2025-10-15','2026-02-28','2024-02-29','2026-03-31','2025-12-01']) {
  for (let n=-24;n<=48;n++){
    const meu = C.somaMesesData(d,n)
    const dfns = format(addMonths(parseISO(d),n),'yyyy-MM-dd')
    if(meu!==dfns){div++;if(div<4)console.log(`   divergiu ${d} +${n}: meu=${meu} date-fns=${dfns}`)}
  }
}
eq('zero divergências', div, 0)

console.log('\n— o caso real: M3PRODUTOS, parcela 12 com a data da 1 —')
const m3 = []
for (let n=1;n<=11;n++) m3.push({id:`x${n}`, description:`M3PRODUTOS (${n}/12)`, purchase_date:C.somaMesesData('2025-10-15',n-1)})
m3.push({id:'x12', description:'M3PRODUTOS (12/12)', purchase_date:'2025-10-15', status:'Pago', paid_date:'2025-10-15'})
eq('consenso ignora a linha errada', C.baseConsenso(m3), '2025-10-15')
const p = C.conferirGrupo(m3, 12)
eq('achou exatamente 1 problema', p.length, 1)
eq('é a parcela 12', [p[0].tipo,p[0].num,p[0].deData,p[0].paraData],
   ['data_fora_de_sequencia',12,'2025-10-15','2026-09-15'])
eq('pagamento foi carimbo automático', C.pagamentoFoiAutomatico(m3[11]), true)

console.log('\n— grupo saudável não pode acusar nada (evita falso positivo) —')
const bom = []
for (let n=1;n<=12;n++) bom.push({id:`b${n}`, description:`Moto (${n}/12)`, purchase_date:C.somaMesesData('2026-02-28',n-1)})
eq('mês curto não vira problema', C.conferirGrupo(bom,12), [])

console.log('\n— parcela faltando e número repetido —')
const faltando = [1,2,4].map(n=>({id:`f${n}`,description:`X (${n}/4)`,purchase_date:C.somaMesesData('2026-01-10',n-1)}))
const pf = C.conferirGrupo(faltando,4)
eq('aponta a 3 faltando', pf.filter(x=>x.tipo==='parcela_faltando').map(x=>[x.num,x.dataEsperada]), [[3,'2026-03-10']])
const repetido = [
  {id:'r1',description:'Y (1/2)',purchase_date:'2026-01-10'},
  {id:'r2',description:'Y (1/2)',purchase_date:'2026-01-10'},
  {id:'r3',description:'Y (2/2)',purchase_date:'2026-02-10'},
]
eq('aponta número repetido', C.conferirGrupo(repetido,2).filter(x=>x.tipo==='numero_repetido').map(x=>x.num), [1])

console.log('\n— linha legada sem número: sugere pelo mês, não pela ordem —')
const semNum = [
  {id:'s1',description:'Z (1/3)',purchase_date:'2026-01-10'},
  {id:'s2',description:'Z (2/3)',purchase_date:'2026-02-10'},
  {id:'s3',description:'Z',      purchase_date:'2026-03-10'},
]
eq('sugere 3 (mês bate)', C.conferirGrupo(semNum,3).find(x=>x.tipo==='sem_numero').numSugerido, 3)

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail?1:0)
