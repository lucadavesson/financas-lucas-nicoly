const D = require('/tmp/dp/duplicatas.js')
let ok=0,fail=0
const eq=(n,a,b)=>{const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){ok++;console.log(`  ok  ${n}`)}else{fail++;console.log(`  FALHA ${n}\n   esperado ${B}\n   recebido ${A}`)}}
const rem=g=>g.reduce((s,x)=>s+x.remover.length,0)

console.log('\n— FALSOS POSITIVOS REAIS que a primeira versão queria apagar —')
const mercadinho=[4.98,5.19,13.46,27.47,41.43].map((v,i)=>
  ({id:`m${i}`,description:'Mercadinho Cond',holder:'Lucas',purchase_date:'2026-06-10',amount:v}))
eq('5 idas ao mercadinho: NADA a remover', rem(D.acharDuplicatas(mercadinho)), 0)
eq('marcadas como "conferir"', D.acharDuplicatas(mercadinho).every(g=>g.certeza==='conferir'), true)

eq('Coca cola 13,40 e 14,00: nada a remover', rem(D.acharDuplicatas([
  {id:'c1',description:'Coca cola',holder:'Lucas',purchase_date:'2026-08-03',amount:13.40},
  {id:'c2',description:'Coca cola',holder:'Lucas',purchase_date:'2026-08-03',amount:14.00},
])), 0)
eq('Padaria 40 e 49: nada a remover', rem(D.acharDuplicatas([
  {id:'p1',description:'Padaria',holder:'Lucas',purchase_date:'2026-06-05',amount:40},
  {id:'p2',description:'Padaria',holder:'Lucas',purchase_date:'2026-06-05',amount:49},
])), 0)
eq('Uber 8,47 e 11,70: nada a remover', rem(D.acharDuplicatas([
  {id:'u1',description:'Uber/99',holder:'Lucas',purchase_date:'2026-06-12',amount:8.47},
  {id:'u2',description:'Uber/99',holder:'Lucas',purchase_date:'2026-06-12',amount:11.70},
])), 0)
eq('mesma descrição em DIAS diferentes nem agrupa', D.acharDuplicatas([
  {id:'a',description:'Padaria',holder:'Lucas',purchase_date:'2026-06-05',amount:40},
  {id:'b',description:'Padaria',holder:'Lucas',purchase_date:'2026-06-06',amount:40},
]).length, 0)

console.log('\n— o que AINDA precisa ser pego —')
const cert=[
  {id:'bom',description:'Certificado - Prata (4/10)',holder:'Lucas',purchase_date:'2026-09-17',installment_value:35.19,amount:351.90},
  {id:'ruim',description:'Certificado - Prata (4/10)',holder:'Lucas',purchase_date:'2026-09-17',amount:351.90},
]
const gc=D.acharDuplicatas(cert)
eq('parcela repetida é duplicata', gc[0].certeza,'duplicata')
eq('mantém a de menor valor',      gc[0].manter,'bom')
eq('remove a outra',               gc[0].remover,['ruim'])

const iguais=[
  {id:'i1',description:'Padaria',holder:'Lucas',purchase_date:'2026-06-05',amount:40},
  {id:'i2',description:'Padaria',holder:'Lucas',purchase_date:'2026-06-05',amount:40},
]
eq('linhas idênticas são duplicata', D.acharDuplicatas(iguais)[0].certeza,'duplicata')
eq('sobra uma',                      D.acharDuplicatas(iguais)[0].remover.length,1)

console.log('\n— resumo separa o que remove do que só avisa —')
const misto=[...cert,...mercadinho]
const g=D.acharDuplicatas(misto)
eq('resumo de duplicatas só tem o Certificado',
   D.resumirPorCompromisso(g,'duplicata').map(r=>r.titulo), ['Certificado - Prata'])
eq('resumo de conferir só tem o Mercadinho',
   D.resumirPorCompromisso(g,'conferir').map(r=>r.titulo), ['Mercadinho Cond'])

console.log('\n— pagamento manual continua protegido —')
eq('não remove pago à mão', D.acharDuplicatas([
  {id:'a',description:'X (1/2)',holder:'Lucas',purchase_date:'2026-09-10',amount:10},
  {id:'b',description:'X (1/2)',holder:'Lucas',purchase_date:'2026-09-10',amount:99,paid_date:'2026-09-15'},
])[0].remover, [])

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail?1:0)
