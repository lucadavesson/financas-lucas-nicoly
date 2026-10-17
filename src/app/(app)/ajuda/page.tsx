'use client'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const BG = '#F5F5F7', TEXT = '#1C1C1E', TEXTMU = '#8E8E93', TERRA = '#C4622D'
const caixa: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.05)' }
const tit: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: TEXT, margin: '0 0 6px' }
const txt: React.CSSProperties = { fontSize: 13, color: '#48484A', margin: '0 0 6px', lineHeight: 1.5 }
const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: TEXTMU, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '18px 4px 8px' }

const TELAS: { nome: string; onde: string; faz: string[] }[] = [
  {
    nome: 'Início (Dashboard)',
    onde: 'Ícone Início na barra inferior',
    faz: [
      'Mostra o resumo do mês: quanto entrou, quanto saiu e quanto falta pagar.',
      'Mostra os próximos vencimentos e o que já foi pago.',
      'Os valores seguem o mês selecionado no topo da tela.',
    ],
  },
  {
    nome: 'Lançamentos',
    onde: 'Ícone Lançamentos na barra inferior',
    faz: [
      'Lista todas as receitas e despesas, com filtros por mês, categoria e status.',
      'Toque em um lançamento para editar ou alterar o status (Previsto, Pendente, Pago, Atrasado ou Cancelado).',
      'Compras parceladas aparecem uma linha por parcela, com o nome no formato "Nome (x/y)".',
    ],
  },
  {
    nome: 'Novo lançamento',
    onde: 'Botão + no centro da barra inferior',
    faz: [
      'Registra uma receita, uma despesa à vista, uma compra parcelada ou uma conta recorrente.',
      'Valores são digitados com máscara de moeda.',
      'Compra no cartão não se paga individualmente: ela entra na fatura do cartão.',
    ],
  },
  {
    nome: 'Cartões',
    onde: 'Ícone Cartões na barra inferior',
    faz: [
      'Mostra cada cartão, com titular, dia de fechamento e vencimento.',
      'Mostra "Por cartão nesta fatura", com o total gasto em cada cartão físico (principal e adicionais).',
      'Para ver a fatura por cartão, importe o PDF em Configurações.',
    ],
  },
  {
    nome: 'Pagamentos',
    onde: 'Menu Relatórios ou Lançamentos, filtrando por pagamentos',
    faz: [
      'Acompanha o que já foi pago e o que ainda falta pagar no mês.',
      'Marcar uma conta como Pago pede a data do pagamento.',
    ],
  },
  {
    nome: 'Parcelamentos',
    onde: 'Acessado a partir dos lançamentos parcelados',
    faz: [
      'Mostra as compras parceladas em andamento, com quantas parcelas faltam e o total restante.',
    ],
  },
  {
    nome: 'Metas',
    onde: 'Ícone de alvo no topo da tela',
    faz: [
      'Define objetivos de economia e acompanha o quanto já foi guardado.',
    ],
  },
  {
    nome: 'Relatórios',
    onde: 'Ícone Relatórios na barra inferior',
    faz: [
      'Gráficos de gastos por categoria e evolução ao longo dos meses.',
    ],
  },
  {
    nome: 'Importar fatura',
    onde: 'Configurações → Importar fatura do cartão',
    faz: [
      'Lê o PDF da fatura no próprio celular. Nada é enviado para fora do aparelho.',
      'Confere a soma com o total da fatura e reconhece o que já está lançado, para não duplicar.',
      'Você só ajusta nome e categoria das compras novas e importa.',
      'Em "Importações anteriores", no fim da tela, dá para desfazer uma importação inteira. Desfazer apaga só os lançamentos daquela importação.',
    ],
  },
  {
    nome: 'Configurações',
    onde: 'Ícone de engrenagem no topo da tela',
    faz: [
      'Cartões e contas, limites por categoria, ciclo salarial e contas recorrentes.',
      'Categorias e subcategorias, segurança (Face ID e logout) e importação de fatura.',
      'Exportação dos dados e limpeza do cache do navegador (não apaga seus lançamentos).',
    ],
  },
]

const DICAS = [
  'Os dados são compartilhados entre Lucas e Nicoly: o que um lança, o outro vê.',
  'Antes de apagar ou desfazer algo, o app sempre pede confirmação.',
  'Use o menu de Configurações para ajustar categorias e cartões antes de importar uma fatura.',
  'Se algo parecer errado, confira primeiro o mês selecionado no topo da tela.',
]

export default function Ajuda() {
  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '16px 16px 160px', maxWidth: 360, margin: '0 auto' }}>
      <Link href="/parametros" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: TEXT, fontSize: 14, fontWeight: 600, textDecoration: 'none', background: '#fff', borderRadius: 12, padding: '8px 12px', marginBottom: 16 }}>
        <ChevronLeft size={16} /> Voltar
      </Link>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Como usar o app</h1>
      <p style={{ fontSize: 13, color: TEXTMU, margin: '0 0 8px', lineHeight: 1.5 }}>
        Guia rápido de cada tela. Consulte sempre que tiver dúvida sobre o que fazer em uma parte do app.
      </p>

      <p style={rotulo}>Telas</p>
      {TELAS.map(t => (
        <div key={t.nome} style={caixa}>
          <p style={tit}>{t.nome}</p>
          <p style={{ fontSize: 11.5, color: TERRA, fontWeight: 600, margin: '0 0 10px' }}>{t.onde}</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {t.faz.map((linha, i) => (
              <li key={i} style={{ ...txt, marginBottom: 6 }}>{linha}</li>
            ))}
          </ul>
        </div>
      ))}

      <p style={rotulo}>Dicas</p>
      <div style={caixa}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {DICAS.map((d, i) => <li key={i} style={{ ...txt, marginBottom: 6 }}>{d}</li>)}
        </ul>
      </div>
    </div>
  )
}
