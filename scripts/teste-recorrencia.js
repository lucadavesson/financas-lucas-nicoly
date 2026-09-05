/**
 * Testes da aritmética de recorrência (mesUtils.ts).
 *
 * Rodar:  npx tsc src/lib/utils/mesUtils.ts --outDir /tmp/t --module commonjs \
 *           --target es2020 --skipLibCheck && node scripts/teste-recorrencia.js
 */
const U = require('/tmp/t/mesUtils.js')
let ok = 0, fail = 0
const eq = (nome, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b)
  if (A === B) { ok++; console.log(`  ok  ${nome}`) }
  else { fail++; console.log(`  FALHA ${nome}\n        esperado ${B}\n        recebido ${A}`) }
}

console.log('\n— aritmética de mês —')
eq('somaMeses vira o ano', U.somaMeses('2026-11', 3), '2027-02')
eq('somaMeses para tras', U.somaMeses('2026-01', -1), '2025-12')
eq('distancia atravessa ano', U.distanciaMeses('2026-09', '2027-03'), 6)
eq('distancia negativa', U.distanciaMeses('2026-09', '2026-07'), -2)

console.log('\n— dia em mês curto (o bug clássico do dia 31) —')
eq('dia 31 em fevereiro', U.dataNoMes('2027-02', 31), '2027-02-28')
eq('dia 31 em fev bissexto', U.dataNoMes('2028-02', 31), '2028-02-29')
eq('dia 31 em abril', U.dataNoMes('2026-04', 31), '2026-04-30')
eq('dia 2 normal', U.dataNoMes('2026-09', 2), '2026-09-02')
eq('dia 0 vira 1', U.dataNoMes('2026-09', 0), '2026-09-01')

console.log('\n— identidade da conta —')
eq('espaço e caixa não criam conta nova',
   U.chaveConta(' Netflix ', 'Lucas'), U.chaveConta('netflix', 'Lucas'))
eq('titular diferente é conta diferente',
   U.chaveConta('Netflix', 'Lucas') === U.chaveConta('Netflix', 'Nicoly'), false)

console.log('\n— resumo de conta a partir das linhas —')
const linhas = [
  { description:'Aluguel', holder:'Lucas', purchase_date:'2026-11-02', amount:200, recurring_active:true },
  { description:'Aluguel', holder:'Lucas', purchase_date:'2026-09-02', amount:180, recurring_active:true },
  { description:'Aluguel', holder:'Lucas', purchase_date:'2026-08-31', amount:180, recurring_active:true },
]
const [c] = U.resumirRecorrentes(linhas)
eq('primeiro mês', c.primeiroMes, '2026-08')
eq('último mês', c.ultimoMes, '2026-11')
eq('template é a ocorrência mais nova', c.template.amount, 200)
eq('conta as ocorrências', c.ocorrencias, 3)

console.log('\n— leitura do prazo —')
eq('ativa = sem prazo', U.prazoDaConta({...c, ativa:true}, '2026-09'), { tipo:'sem_prazo' })
eq('inativa com futuro = prazo em curso',
   U.prazoDaConta({...c, ativa:false}, '2026-09'), { tipo:'com_prazo', ultimoMes:'2026-11', restantes:2 })
eq('inativa sem futuro = encerrada',
   U.prazoDaConta({...c, ativa:false}, '2026-12'), { tipo:'encerrada', ultimoMes:'2026-11' })
eq('uma linha encerrada encerra a conta',
   U.resumirRecorrentes([...linhas.slice(0,2), {...linhas[2], recurring_active:false}])[0].ativa, false)

console.log('\n— janela de aparição (o que o usuário perguntou) —')
const dentro = (conta, mes) => conta.ativa
  ? (mes >= conta.primeiroMes)
  : (mes >= conta.primeiroMes && mes <= conta.ultimoMes)
const semPrazo = {...c, ativa:true}
const comPrazo = {...c, ativa:false}
eq('sem prazo aparece em mês distante', dentro(semPrazo, '2028-05'), true)
eq('sem prazo NÃO aparece antes de existir', dentro(semPrazo, '2026-07'), false)
eq('com prazo aparece dentro da janela', dentro(comPrazo, '2026-10'), true)
eq('com prazo NÃO aparece depois do fim', dentro(comPrazo, '2026-12'), false)

console.log('\n— rótulo —')
eq('rótulo pt-BR', U.rotuloMes('2027-01'), 'jan/2027')

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail ? 1 : 0)
