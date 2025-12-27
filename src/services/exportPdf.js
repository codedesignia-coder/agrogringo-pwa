/**
 * Función central que convierte un elemento HTML en un objeto Canvas.
 * Esta es la base para todas las exportaciones.
 * @param {HTMLElement} element - El elemento del DOM a capturar.
 * @returns {Promise<HTMLCanvasElement>} - Una promesa que resuelve al objeto Canvas.
 */
async function generateCanvasFromElement(element) {
  if (!element) {
    throw new Error(
      "No se proporcionó un elemento válido para generar el canvas."
    );
  }

  // Importación dinámica de html2canvas
  const html2canvas = (await import("html2canvas")).default;

  return await html2canvas(element, {
    scale: 2, // Aumenta la resolución para un PDF más nítido.
    useCORS: true, // Permite cargar imágenes de otros dominios (si aplica).
    backgroundColor: null, // Usa el fondo del elemento.
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

/**
 * Exporta un elemento HTML como un archivo PDF de varias páginas.
 * @param {HTMLElement} element - El elemento del DOM a capturar.
 * @param {string} fileName - El nombre del archivo PDF a generar.
 */
export async function exportElementAsPdf(element, fileName) {
  const canvas = await generateCanvasFromElement(element);
  const imgData = canvas.toDataURL("image/png");

  // Importación dinámica de jsPDF
  const { default: jsPDF } = await import("jspdf");

  // 1. Crear una instancia inicial de jsPDF para usar sus métodos.
  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
  });

  // 2. Calcular las dimensiones correctas.
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

  // 3. Establecer el tamaño de la página y añadir la imagen.
  pdf.internal.pageSize.setWidth(pdfWidth);
  pdf.internal.pageSize.setHeight(imgHeight);
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);

  pdf.save(fileName);
}
