import React from 'react';
import logo from '@/assets/logo_agrogringo.jpeg'; // 1. Importamos el logo

/**
 * Este componente es una versión no interactiva y puramente visual
 * de RecommendationDetailPage, diseñada para ser renderizada y
 * convertida a PDF.
 */
export function RecommendationPdfLayout({ recommendation }) {
    if (!recommendation) return null;

    const {
        noHoja,
        fecha,
        estado,
        faseTratamiento,
        datosAgricultor,
        datosTecnico,
        cultivo,
        diagnostico,
        detallesProductos,
        recomendaciones,
        seguimiento,
        firmaAgricultor,
        firmaTecnico,
    } = recommendation;

    const estadoStyles = {
        'Pendiente': 'bg-yellow-100 text-yellow-800',
        'En tratamiento': 'bg-blue-100 text-blue-800',
        'Finalizado': 'bg-green-100 text-green-800',
    };

    // Helper para mostrar imágenes tanto si son URLs (online) como Blobs (offline)
    const getImageUrl = (img) => {
        if (!img) return null;
        if (img instanceof Blob || img instanceof File) {
            return URL.createObjectURL(img);
        }
        return img;
    };

    // Usamos 'break-inside-avoid' en las secciones para prevenir que se corten al generar el PDF.
    // Esto es clave para evitar que las imágenes y el texto se partan entre páginas.
    return (
        <div
            className="bg-white"
            style={{ width: '800px' }} // Ancho fijo para consistencia en el PDF
        >
            {/* HEADER */}
            <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6">
                <div className="flex flex-row justify-between items-center">
                    <div className="flex items-center">
                        {/* 2. Reemplazamos el emoji por el logo circular */}
                        <img src={logo} alt="Logo AgroGringo" className="h-14 w-14 mr-4 rounded-full object-cover" />
                        <div>
                            <h1 className="text-2xl font-bold text-shadow">AGRO GRINGO - AGUAYTIA</h1>
                            <p className="font-semibold">HOJA DE RECOMENDACIÓN TÉCNICA</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="bg-white/25 px-4 py-2 rounded-lg text-lg font-bold mt-1">
                            N° {noHoja}
                        </div>
                        <p className="mt-2 text-sm">Fecha: {new Date(fecha).toLocaleString()}</p>
                        {/* Solución con Flexbox para un centrado vertical robusto en PDF */}
                        <div className="mt-2">
                            <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full ${estadoStyles[estado]}`}>
                                {estado}
                            </span>
                            {faseTratamiento && (
                                <span className="ml-2 inline-block px-3 py-2 text-xs font-semibold bg-gray-200 text-gray-700 rounded-full">
                                    {faseTratamiento}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Datos del Agricultor */}
                <section className="p-4 bg-gray-50 rounded-lg border" style={{ breakInside: 'avoid' }}>
                    <h2 className="text-lg font-bold text-green-800 mb-3">👨‍🌾 Datos del Agricultor</h2>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <p><strong>Nombre:</strong> {datosAgricultor.nombre}</p>
                        <p><strong>DNI/RUC:</strong> {datosAgricultor.dni}</p>
                        <p><strong>Celular:</strong> {datosAgricultor.celular || 'N/A'}</p>
                        <p className="col-span-2"><strong>Dirección:</strong> {datosAgricultor.direccion}</p>
                        <p><strong>Provincia:</strong> {datosAgricultor.provincia}</p>
                        <p><strong>Distrito:</strong> {datosAgricultor.distrito}</p>
                        <p><strong>Adelanto:</strong> S/ {datosAgricultor.adelanto?.toFixed(2) || '0.00'}</p>
                    </div>
                </section>

                {/* Datos del Técnico */}
                <section className="p-4 bg-gray-50 rounded-lg border" style={{ breakInside: 'avoid' }}>
                    <h2 className="text-lg font-bold text-green-800 mb-3">🧑‍🔬 Representante Técnico</h2>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <p><strong>Nombre:</strong> {datosTecnico.nombre}</p>
                        <p><strong>Email:</strong> {datosTecnico.email}</p>
                        <p><strong>CIP:</strong> {datosTecnico.cip || 'N/A'}</p>
                        <p><strong>Teléfono:</strong> {datosTecnico.telefono || 'N/A'}</p>
                    </div>
                </section>

                {/* Diagnóstico */}
                <section className="p-4 bg-gray-50 rounded-lg border" style={{ breakInside: 'avoid' }}>
                    <h2 className="text-lg font-bold text-green-800 mb-3">🔬 Diagnóstico en Cultivo</h2>
                    <p className="text-sm mb-2"><strong>Cultivo de:</strong> {cultivo || 'No especificado'}</p>
                    <p className="text-sm whitespace-pre-wrap">{diagnostico}</p>
                    {seguimiento?.fotoAntes && (
                        <div className="mt-4">
                            <h3 className="font-semibold text-sm mb-2">Foto del Cultivo (Antes):</h3>
                            <img
                                src={getImageUrl(seguimiento.fotoAntes)}
                                alt="Foto del cultivo antes del tratamiento"
                                className="rounded-lg border max-w-sm mx-auto"
                            />
                        </div>
                    )}
                </section>

                {/* Seguimiento Final */}
                {estado === 'Finalizado' && (seguimiento?.fotoDespues || seguimiento?.observaciones) && (
                    <section className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500" style={{ breakInside: 'avoid' }}>
                        <h2 className="text-lg font-bold text-green-800 mb-3">✅ Seguimiento y Resultados</h2>
                        {seguimiento?.fotoDespues && (
                            <div className="mt-4">
                                <h3 className="font-semibold text-sm mb-2">Foto del Cultivo (Después):</h3>
                                <img
                                    src={getImageUrl(seguimiento.fotoDespues)}
                                    alt="Foto del cultivo después del tratamiento"
                                    className="rounded-lg border max-w-sm mx-auto"
                                />
                            </div>
                        )}
                        {seguimiento?.observaciones && (
                            <div className="mt-4">
                                <h3 className="font-semibold text-sm mb-2">Observaciones Finales:</h3>
                                <p className="text-sm bg-white p-3 rounded-md border whitespace-pre-wrap">{seguimiento.observaciones}</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Productos Recomendados */}
                <section className="p-4 bg-gray-50 rounded-lg border" style={{ breakInside: 'avoid' }}>
                    <h2 className="text-lg font-bold text-green-800 mb-3">📦 Productos Recomendados</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="p-2 text-left font-semibold">Producto</th>
                                    <th className="p-2 text-left font-semibold">Cantidad</th>
                                    <th className="p-2 text-left font-semibold">Dosis / Instrucciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detallesProductos.map((p, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-2">{p.producto}</td>
                                        <td className="p-2">{p.cantidad} {p.unidad}</td>
                                        <td className="p-2">{p.formaUso || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Recomendaciones de Seguridad */}
                <section className="p-4 bg-green-50 rounded-lg border-green-200 border" style={{ breakInside: 'avoid' }}>
                    <h2 className="text-lg font-bold text-green-800 mb-3">💡 Recomendación</h2>
                    <ul className="space-y-1 list-disc list-inside text-sm">
                        {recomendaciones.filter(r => r).map((rec, index) => (
                            <li key={index}>{rec}</li>
                        ))}
                    </ul>
                </section>

                {/* Firmas */}
                <section className="p-4 bg-gray-50 rounded-lg border" style={{ breakInside: 'avoid' }}>
                    <h2 className="text-lg font-bold text-green-800 mb-3">✍️ Firmas</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <h3 className="font-semibold">Firma del Agricultor</h3>
                            {firmaAgricultor ? (
                                <img
                                    src={typeof firmaAgricultor === 'object' ? firmaAgricultor.dataUrl : firmaAgricultor}
                                    alt="Firma Agricultor"
                                    className="mx-auto mt-2 bg-white border rounded"
                                />
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">(No registrada)</p>
                            )}
                        </div>
                        <div className="text-center">
                            <h3 className="font-semibold">Firma del Técnico</h3>
                            {firmaTecnico ? (
                                <img
                                    src={typeof firmaTecnico === 'object' ? firmaTecnico.dataUrl : firmaTecnico}
                                    alt="Firma Técnico"
                                    className="mx-auto mt-2 bg-white border rounded"
                                />
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">(No registrada)</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Frase de Responsabilidad */}
                <section className="text-center mt-8 pt-4 border-t border-dashed" style={{ breakInside: 'avoid' }}>
                    {/* 4. Cambiamos el estilo de la fuente a uno más legible */}
                    <p className="text-xl font-semibold italic text-green-800">
                        "Responsabilidad para producir Alimentos saludables"
                    </p>
                </section>

                {/* Footer del PDF */}
                <footer className="mt-4 border-t pt-4 text-center text-xs text-gray-500" style={{ breakBefore: 'page' }}>
                    Generado por AgroGringo PWA - {new Date().toLocaleString()}
                </footer>
            </div>
        </div>
    );
}