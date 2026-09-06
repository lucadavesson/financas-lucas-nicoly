const D = require('/tmp/dp/duplicatas.js')
let ok=0,fail=0
const eq=(n,a,b)=>{const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){ok++;console.log(`  ok  ${n}`)}else{fail++;console.log(`  FALHA ${n}\n   esperado ${B}\n   recebido ${A}`)}}

console.log('\n— o caso real: série boa (35,19) x série fantasma (351,90) —')
const linhas=[]
for(let n=4;n<=13;n++){
  const mes=String(6+(n-4)).padStart(2,'0')
  const ano=6+(n-4)>12?2027:2026
  const mm=String(((6+(n-4)-1)%12)+1).padStart(2,'0')
  linhas.push({id:`bom${n}`,description:`Certificado - Prata (${n}/10)`,holder:'Lucas',
    purchase_date:`${ano}-${mm}-17`,installment_value:35.19,amount:351.90,status:'Previsto'})
  linhas.push({id:`ruim${n}`,description:`Certificado - Prata (${n}/10)`,holder:'Lucas',
    purchase_date:`${ano}-${mm}-17`,amount:351.90,status:'Previsto'})
}
// série da Nicoly, nome diferente: NÃO pode ser confundida
for(let n=4;n<=13;n++){
  const ano=6+(n-4)>12?2027:2026
  const mm=String(((6+(n-4)-1)%12)+1).padStart(2,'0')
  linhas.push({id:`nic${n}`,description:`Certificado digital - Prata (${n}/10)`,holder:'Nicoly',
    purchase_date:`${ano}-${mm}-17`,installment_value:35.19,amount:351.90,status:'Previsto'})
}

const g=D.acharDuplicatas(linhas)
eq('achou 10 meses duplicados', g.length, 10)
eq('mantém a de 35,19', g[0].linhas.find(l=>l.id===g[0].manter).valor, 35.19)
eq('em todo mês remove só a fantasma',
   g.every(x=>x.remover.length===1&&x.remover[0].startsWith('ruim')), true)
eq('nunca remove a série boa',
   g.every(x=>x.manter.startsWith('bom')), true)
eq('a série da Nicoly não entra', g.every(x=>!x.descricao.includes('digital')), true)
eq('total a remover = 10', g.reduce((s,x)=>s+x.remover.length,0), 10)

console.log('\n— resumo por compromisso —')
const r=D.resumirPorCompromisso(g)
eq('um compromisso só',        r.length, 1)
eq('título sem o (n/10)',      r[0].titulo, 'Certificado - Prata')
eq('10 meses afetados',        r[0].meses.length, 10)
eq('mostra os dois valores',   r[0].valores, [35.19, 351.9])

console.log('\n— o que NÃO pode ser marcado como duplicata —')
eq('mesma descrição, meses diferentes', D.acharDuplicatas([
  {id:'a',description:'Uber',holder:'Lucas',purchase_date:'2026-09-01',amount:20},
  {id:'b',description:'Uber',holder:'Lucas',purchase_date:'2026-10-01',amount:20},
]).length, 0)
eq('mesma descrição, titulares diferentes', D.acharDuplicatas([
  {id:'a',description:'Netflix',holder:'Lucas',purchase_date:'2026-09-01',amount:44.9},
  {id:'b',description:'Netflix',holder:'Nicoly',purchase_date:'2026-09-05',amount:44.9},
]).length, 0)
eq('parcelas diferentes da mesma compra', D.acharDuplicatas([
  {id:'a',description:'Moto (7/12)',holder:'Lucas',purchase_date:'2026-09-01',amount:621},
  {id:'b',description:'Moto (8/12)',holder:'Lucas',purchase_date:'2026-09-01',amount:621},
]).length, 0)
eq('cancelado é ignorado', D.acharDuplicatas([
  {id:'a',description:'X',holder:'Lucas',purchase_date:'2026-09-01',amount:10},
  {id:'b',description:'X',holder:'Lucas',purchase_date:'2026-09-02',amount:99,status:'Cancelado'},
]).length, 0)

console.log('\n— pagamento registrado à mão é protegido, não apagado —')
const prot=D.acharDuplicatas([
  {id:'a',description:'Y',holder:'Lucas',purchase_date:'2026-09-10',amount:10},
  {id:'b',description:'Y',holder:'Lucas',purchase_date:'2026-09-10',amount:99,paid_date:'2026-09-15'},
])
eq('não remove o pago à mão', prot[0].remover, [])
eq('avisa que protegeu',      prot[0].protegidas.length, 1)
eq('carimbo automático pode remover', D.acharDuplicatas([
  {id:'a',description:'Z',holder:'Lucas',purchase_date:'2026-09-10',amount:10},
  {id:'b',description:'Z',holder:'Lucas',purchase_date:'2026-09-10',amount:99,paid_date:'2026-09-10'},
])[0].remover, ['b'])

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail?1:0)
