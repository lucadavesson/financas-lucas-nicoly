// Simula a regra de vigência sobre linhas, do jeito que aplicarAjusteRecorrente faz,
// para provar que o passado não é tocado e que a data acompanha o dia novo.
const U = require('/tmp/t/mesUtils.js')
let ok=0, fail=0
const eq=(n,a,b)=>{const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){ok++;console.log(`  ok  ${n}`)}else{fail++;console.log(`  FALHA ${n}\n        esperado ${B}\n        recebido ${A}`)}}

const HOJE='2026-09'
// Aluguel: ago pago, set em aberto, out e nov projetados
const linhas=[
  {mes:'2026-07', dia:'2026-07-02', valor:180, status:'Pago'},
  {mes:'2026-08', dia:'2026-08-02', valor:180, status:'Pendente'}, // passado EM ABERTO (atrasado)
  {mes:'2026-09', dia:'2026-09-02', valor:180, status:'Pendente'},
  {mes:'2026-10', dia:'2026-10-02', valor:180, status:'Previsto'},
  {mes:'2026-11', dia:'2026-11-02', valor:180, status:'Previsto'},
]
function aplicar(ls,{aPartirDe,valor,dia}){
  return ls.map(l=>{
    if(l.status==='Pago') return l                 // regra 2
    if(l.mes < aPartirDe) return l                 // regra 3
    return {...l, valor: valor??l.valor, dia: dia?U.dataNoMes(l.mes,dia):l.dia}
  })
}

console.log('\n— reajuste "deste mês em diante" (padrão) —')
let r=aplicar(linhas,{aPartirDe:HOJE,valor:200})
eq('julho pago intacto',        r[0].valor,180)
eq('AGOSTO EM ABERTO INTACTO',  r[1].valor,180)
eq('setembro reajustado',       r[2].valor,200)
eq('outubro reajustado',        r[3].valor,200)

console.log('\n— reajuste agendado para o futuro —')
r=aplicar(linhas,{aPartirDe:'2026-11',valor:250})
eq('setembro segue no antigo',  r[2].valor,180)
eq('outubro segue no antigo',   r[3].valor,180)
eq('novembro no valor novo',    r[4].valor,250)

console.log('\n— mudou o dia de vencimento: a data anda junto —')
r=aplicar(linhas,{aPartirDe:HOJE,dia:10})
eq('agosto mantém a data real', r[1].dia,'2026-08-02')
eq('setembro move para dia 10', r[2].dia,'2026-09-10')
eq('novembro move para dia 10', r[4].dia,'2026-11-10')

console.log('\n— dia 31 numa conta que passa por fevereiro —')
const ls2=[{mes:'2027-01',dia:'2027-01-05',valor:100,status:'Pendente'},
           {mes:'2027-02',dia:'2027-02-05',valor:100,status:'Previsto'},
           {mes:'2027-03',dia:'2027-03-05',valor:100,status:'Previsto'}]
r=aplicar(ls2,{aPartirDe:'2027-01',dia:31})
eq('janeiro dia 31',  r[0].dia,'2027-01-31')
eq('fevereiro cai no 28', r[1].dia,'2027-02-28')
eq('março dia 31',    r[2].dia,'2027-03-31')

console.log('\n— salário: mesma regra —')
const sal=[{mes:'2026-08',dia:'2026-08-01',valor:7000,status:'Pago'},
           {mes:'2026-09',dia:'2026-09-01',valor:7000,status:'Previsto'},
           {mes:'2026-10',dia:'2026-10-01',valor:7000,status:'Previsto'}]
r=aplicar(sal,{aPartirDe:'2026-10',valor:8000,dia:5})
eq('agosto recebido intacto',   [r[0].valor,r[0].dia],[7000,'2026-08-01'])
eq('setembro ainda no antigo',  [r[1].valor,r[1].dia],[7000,'2026-09-01'])
eq('outubro com aumento e data nova',[r[2].valor,r[2].dia],[8000,'2026-10-05'])

console.log('\n— prazo: por 12 meses a partir de set/2026 —')
const fim=U.somaMeses('2026-09',11)
eq('termina em ago/2027', fim, '2027-08')
eq('rótulo', U.rotuloMes(fim), 'ago/2027')
const janela=(m)=>m>='2026-09'&&m<=fim
eq('aparece no primeiro mês', janela('2026-09'),true)
eq('aparece no último mês',   janela('2027-08'),true)
eq('NÃO aparece depois',      janela('2027-09'),false)
eq('NÃO aparece antes',       janela('2026-08'),false)

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail?1:0)
