// Client-side PDF export using html2pdf.js
export async function exportToPDF(
  elementId: string,
  filename: string
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error('Element not found')
  }

  // Dynamically import html2pdf to avoid SSR issues
  const html2pdf = (await import('html2pdf.js')).default

  const opt = {
    margin: 0.5,
    filename: `${filename}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: {
      unit: 'in' as const,
      format: 'letter' as const,
      orientation: 'portrait' as const,
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'] as const,
      before: '.page-break-before',
      after: '.page-break-after',
      avoid: '.page-break-avoid',
    },
  }

  await html2pdf().set(opt).from(element).save()
}
