/**
 * Exporta una lista de recomendaciones a un archivo Excel (.xlsx).
 * @param {Array<object>} recommendations - La lista de objetos de recomendación.
 * @param {string} fileName - El nombre del archivo a generar (sin extensión).
 */
export async function exportToExcel(
  recommendations,
  fileName = "Recomendaciones_AgroGringo"
) {
  if (!recommendations || recommendations.length === 0) {
    console.error("No hay datos para exportar.");
    return;
  }

  // Importación dinámica: Solo carga la librería cuando se ejecuta esta función
  const XLSX = await import("xlsx");

  // 1. Transformar los datos a un formato plano para la hoja de cálculo.
  const dataForSheet = recommendations.map((rec) => ({
    "N° Hoja": rec.noHoja,
    Fecha: new Date(rec.fecha).toLocaleDateString("es-PE"),
    Estado: rec.estado,
    "Fase Tratamiento": rec.faseTratamiento || "N/A",
    "Cliente Nombre": rec.datosAgricultor?.nombre,
    "Cliente DNI/RUC": rec.datosAgricultor?.dni,
    "Cliente Celular": rec.datosAgricultor?.celular,
    "Cliente Dirección": rec.datosAgricultor?.direccion,
    Provincia: rec.datosAgricultor?.provincia,
    Distrito: rec.datosAgricultor?.distrito,
    "Adelanto (S/.)": rec.datosAgricultor?.adelanto?.toFixed(2) || "0.00",
    Cultivo: rec.cultivo,
    Diagnóstico: rec.diagnostico,
    // --- MEJORA IMPORTANTE AQUÍ ---
    // 1. Filtramos para quitar productos vacíos o sin nombre.
    // 2. Usamos .join("\n") para que cada producto aparezca en una nueva línea dentro de la misma celda en Excel.
    Productos: (rec.detallesProductos || [])
      .filter((p) => p && p.producto)
      .map((p) =>
        `${p.producto} (${p.cantidad || ""} ${p.unidad || ""})`.trim()
      )
      .join("\n"),
    Recomendaciones: (rec.recomendaciones || []).join(", "),
    "Técnico Nombre": rec.datosTecnico?.nombre,
    "Técnico Email": rec.datosTecnico?.email,
    "Observaciones Finales": rec.seguimiento?.observaciones || "",
  }));

  // 2. Crear una hoja de trabajo (worksheet) a partir de los datos JSON.
  const ws = XLSX.utils.json_to_sheet(dataForSheet);

  // Opcional: Ajustar el ancho de las columnas
  const columnWidths = Object.keys(dataForSheet[0]).map((key) => {
    // Calcula un ancho basado en el título o un mínimo de 15 caracteres
    const width = Math.max(
      15,
      key.length,
      ...dataForSheet.map((row) => (row[key] ? row[key].toString().length : 0))
    );
    return { wch: Math.min(width, 50) }; // Limita el ancho máximo a 50
  });
  ws["!cols"] = columnWidths;

  // 3. Crear un nuevo libro de trabajo (workbook).
  const wb = XLSX.utils.book_new();

  // 4. Añadir la hoja de trabajo al libro, con el nombre "Recomendaciones".
  XLSX.utils.book_append_sheet(wb, ws, "Recomendaciones");

  // 5. Generar el archivo .xlsx y disparar la descarga.
  const finalFileName = `${fileName}_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  XLSX.writeFile(wb, finalFileName);
}
