import type { PaginaPdf } from '@/lib/utils/faturaPdf'

/**
 * Lê o PDF no próprio navegador (nada sai do aparelho) e devolve as palavras com
 * posição, que o leitor de fatura transforma em lançamentos.
 * O worker do pdf.js fica em /public (mesma versão da biblioteca).
 */
export async function lerPaginasDoPdf(file: File): Promise<PaginaPdf[]> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  const paginas: PaginaPdf[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    paginas.push({
      width: vp.width,
      items: tc.items
        .filter((i: any) => typeof i.str === 'string')
        .map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width })),
    })
  }
  return paginas
}
