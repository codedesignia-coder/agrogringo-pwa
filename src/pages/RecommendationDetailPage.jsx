import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRecommendationById } from '@/services/api/recommendations';
import toast from 'react-hot-toast';
import { exportElementAsPdf } from '@/services/exportPdf.js';
import logo from '@/assets/logo_agrogringo.jpeg';
import { RecommendationPdfLayout } from '../components/RecommendationPdfLayout';

export function RecommendationDetailPage() {
    const { id } = useParams();
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pdfLayoutRef = useRef(null); // 3. Ref para el componente del PDF

    // El ID de la URL es un string, lo convertimos a número para la API
    // pero lo guardamos como string para la compatibilidad con IDs de Dexie.
    const recommendationId = id;

    useEffect(() => {
        const fetchRecommendation = async () => {
            try {
                setLoading(true);
                // El ID de la URL es un string, lo convertimos a número para la API.
                const data = await getRecommendationById(recommendationId);
                if (data) {
                    setRecommendation(data);
                } else {
                    setError('No se encontró la recomendación.');
                }
            } catch (err) {
                setError('Error al cargar los datos de la recomendación.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (recommendationId) {
            fetchRecommendation();
        }
    }, [recommendationId]);

    // 4. Función para manejar la exportación
    const handleExport = async () => {
        if (!pdfLayoutRef.current) {
            toast.error('El contenido para exportar no está listo. Intenta de nuevo.');
            return;
        }

        const rec = recommendation;
        const baseFileName = `recomendacion-${rec.noHoja || rec.localId || Date.now()}`;

        try {
            const t = toast.loading('Generando PDF...');
            await exportElementAsPdf(pdfLayoutRef.current, `${baseFileName}.pdf`);
            toast.dismiss(t);
            toast.success('PDF descargado con éxito.');
        } catch (error) {
            console.error(error);
            toast.error('Error al generar el PDF.');
        }
    };

    if (loading) return <p className="p-4 text-center">Cargando detalle de la recomendación...</p>;
    if (error) return <p className="p-4 text-center text-red-500">{error}</p>;
    if (!recommendation) return null;

    const {
        noHoja,
        fecha,
        estado,
        faseTratamiento,
        datosAgricultor,
        datosTecnico,
        cultivo, // Añadimos el cultivo
        diagnostico,
        detallesProductos,
        recomendaciones,
        seguimiento, // Añadimos seguimiento para acceder a las fotos
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

    return (
        <div className="max-w-4xl p-4 mx-auto">
            {/* 5. Renderizar el layout del PDF fuera de la pantalla para poder capturarlo */}
            <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
                <div ref={pdfLayoutRef}>
                    <RecommendationPdfLayout recommendation={recommendation} />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* HEADER */}
                <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center mb-4 sm:mb-0">
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
                            {/* Usamos h-7 y leading-7 para forzar el centrado vertical */}
                            <div className={`mt-2 inline-block px-3 text-sm font-bold rounded-full h-7 leading-7 ${estadoStyles[estado] || 'bg-gray-100 text-gray-800'}`}>
                                {estado} {faseTratamiento && `(${faseTratamiento})`}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Datos del Agricultor */}
                    <section className="p-4 bg-gray-50 rounded-lg border">
                        <h2 className="text-lg font-bold text-green-800 mb-3">👨‍🌾 Datos del Agricultor</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <p><strong>Nombre:</strong> {datosAgricultor.nombre}</p>
                            <p><strong>DNI/RUC:</strong> {datosAgricultor.dni}</p>
                            <p><strong>Celular:</strong> {datosAgricultor.celular || 'N/A'}</p>
                            <p className="md:col-span-2"><strong>Dirección:</strong> {datosAgricultor.direccion}</p>
                            <p><strong>Provincia:</strong> {datosAgricultor.provincia}</p>
                            <p><strong>Distrito:</strong> {datosAgricultor.distrito}</p>
                            <p><strong>Adelanto:</strong> S/ {datosAgricultor.adelanto?.toFixed(2) || '0.00'}</p>
                        </div>
                    </section>

                    {/* Datos del Técnico */}
                    <section className="p-4 bg-gray-50 rounded-lg border">
                        <h2 className="text-lg font-bold text-green-800 mb-3">🧑‍🔬 Representante Técnico</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <p><strong>Nombre:</strong> {datosTecnico.nombre}</p>
                            <p><strong>Email:</strong> {datosTecnico.email}</p>
                            <p><strong>CIP:</strong> {datosTecnico.cip || 'N/A'}</p>
                            <p><strong>Teléfono:</strong> {datosTecnico.telefono || 'N/A'}</p>
                        </div>
                    </section>

                    {/* Diagnóstico */}
                    <section className="p-4 bg-gray-50 rounded-lg border">
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
                        <section className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
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
                    <section className="p-4 bg-gray-50 rounded-lg border">
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
                    <section className="p-4 bg-green-50 rounded-lg border-green-200 border">
                        <h2 className="text-lg font-bold text-green-800 mb-3">💡 Recomendación</h2>
                        <ul className="space-y-1 list-disc list-inside text-sm">
                            {recomendaciones.filter(r => r).map((rec, index) => (
                                <li key={index}>{rec}</li>
                            ))}
                        </ul>
                    </section>

                    {/* Firmas */}
                    <section className="p-4 bg-gray-50 rounded-lg border">
                        <h2 className="text-lg font-bold text-green-800 mb-3">✍️ Firmas</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    {/* Botón para volver */}
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                        <Link
                            to="/"
                            className="btn btn-back bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2"
                        >
                            <span>← Volver a la Lista</span>
                        </Link>
                        {/* Botón único para generar PDF */}
                        <button
                            onClick={handleExport}
                            className="btn btn-export bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2"
                        >
                            📄 Generar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}