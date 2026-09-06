const C = require('/tmp/ct/cartoes.js')
let ok=0,fail=0
const eq=(n,a,b)=>{const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){ok++;console.log(`  ok  ${n}`)}else{fail++;console.log(`  FALHA ${n}\n   esperado ${B}\n   recebido ${A}`)}}

const cards=[
  {id:'sl',name:'Santander',holder:'Lucas'},
  {id:'sn',name:'Santander',holder:'Nicoly'},
  {id:'nl',name:'Nubank',holder:'Lucas'},
  {id:'nn',name:'Nubank',holder:'Nicoly'},
]

console.log('\n— o bug relatado: cartão novo com mesmo nome —')
const txs=[
  {id:'t1',card_name:'Santander — Lucas',holder:'Lucas'},
  {id:'t2',card_name:'Santander — Nicoly',holder:'Nicoly'},
  {id:'t3',card_name:'Nubank — Nicoly',holder:'Lucas'},   // gasto do Lucas no cartão dela
]
const m=C.atribuirCartoes(txs,cards)
eq('compra do Lucas fica só no cartão dele', m.get('t1'),'sl')
eq('compra da Nicoly fica no dela',          m.get('t2'),'sn')
eq('gasto do Lucas no cartão dela vai pro cartão dela', m.get('t3'),'nn')

console.log('\n— nenhum lançamento pode cair em dois cartões —')
const contagem={}
for(const c of cards) contagem[c.id]=0
for(const [,cid] of m) contagem[cid]++
eq('total atribuído = total de lançamentos',
   Object.values(contagem).reduce((a,b)=>a+b,0), txs.length)

console.log('\n— variações de traço e espaço (dado digitado à mão) —')
const m2=C.atribuirCartoes([
  {id:'a',card_name:'Santander - Lucas',holder:'Lucas'},
  {id:'b',card_name:'  santander   —   nicoly ',holder:'Nicoly'},
  {id:'c',card_name:'Santander – Lucas',holder:'Lucas'},
],cards)
eq('hífen simples',   m2.get('a'),'sl')
eq('caixa e espaços', m2.get('b'),'sn')
eq('traço curto',     m2.get('c'),'sl')

console.log('\n— dado antigo só com o nome do cartão —')
const m3=C.atribuirCartoes([
  {id:'x',card_name:'Santander',holder:'Nicoly'},
  {id:'y',card_name:'Santander',holder:'Lucas'},
  {id:'z',card_name:'Santander',holder:'Prata'},   // titular que não tem cartão
],cards)
eq('desempata pelo titular (Nicoly)', m3.get('x'),'sn')
eq('desempata pelo titular (Lucas)',  m3.get('y'),'sl')
eq('sem desempate, escolhe UM só',    typeof m3.get('z'),'string')

console.log('\n— nome mais longo não é abocanhado pelo mais curto —')
const cards2=[{id:'n',name:'Nubank',holder:'Lucas'},{id:'nu',name:'Nubank Ultravioleta',holder:'Lucas'}]
const m4=C.atribuirCartoes([{id:'p',card_name:'Nubank Ultravioleta — Lucas',holder:'Lucas'}],cards2)
eq('vai pro Ultravioleta', m4.get('p'),'nu')

console.log('\n— sem cartão não atribui nada —')
const m5=C.atribuirCartoes([{id:'s1',card_name:'',holder:'Lucas'},{id:'s2',card_name:null,holder:'Lucas'},
  {id:'s3',card_name:'Cartão Inexistente',holder:'Lucas'}],cards)
eq('nenhum atribuído', m5.size, 0)

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail?1:0)
