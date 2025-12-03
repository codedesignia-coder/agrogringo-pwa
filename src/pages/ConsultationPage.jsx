import { useState, useEffect, useRef } from 'react';
import { onRecommendationsUpdate, deleteRecommendation } from '@/services/api/recommendations'; // CAMBIO: Importamos la nueva función
import { useAuth } from '@/hooks/useAuth'; // Asegúrate de que la ruta sea correcta
import toast from 'react-hot-toast';
import { ChevronDownIcon, FunnelIcon } from '@heroicons/react/24/solid'; // Necesitarás instalar @heroicons/react
import { Link } from 'react-router-dom';
import { exportElementAsPdf } from '@/services/exportPdf.js';
import { RecommendationPdfLayout } from '../components/RecommendationPdfLayout';
import logo from '@/assets/logo_agrogringo.jpeg'; // Importamos el logo
import { exportToExcel } from '@/services/excelExporter'; // ¡Importamos el nuevo exportador!

export function ConsultationPage() {
    const [allRecommendations, setAllRecommendations] = useState([]); // NUEVO: Estado para guardar TODOS los datos
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    // NUEVO: id de la recomendación seleccionada para exportar
    const [selectedRecId, setSelectedRecId] = useState(null);
    const pdfLayoutRef = useRef(null); // Ref para el componente del PDF/Imagen

    // Estados para los filtros
    const [clientFilter, setClientFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFromFilter, setDateFromFilter] = useState('');
    const [dateToFilter, setDateToFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false); // Estado para mostrar/ocultar filtros en móvil

    // Estilos para los estados, para mantener consistencia
    const estadoStyles = {
        'Pendiente': 'bg-yellow-100 text-yellow-800',
        'En tratamiento': 'bg-blue-100 text-blue-800',
        'Finalizado': 'bg-green-100 text-green-800',
    };

    // Efecto para la suscripción en tiempo real
    useEffect(() => {
        if (!user) return;

        setLoading(true);
        // onRecommendationsUpdate nos devuelve una función para "desuscribirnos"
        const unsubscribe = onRecommendationsUpdate(user.uid, (recommendations) => {
            setAllRecommendations(recommendations); // Guardamos la lista completa
            setFilteredData(recommendations); // Inicialmente, los datos filtrados son todos los datos
            setLoading(false);
        });

        // La función de limpieza de useEffect se encarga de llamar a unsubscribe
        // cuando el componente se desmonta. Esto es CRUCIAL para evitar fugas de memoria.
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        // Efecto para aplicar los filtros cuando cambian los filtros o la lista maestra
        const applyFilters = () => {
            let data = [...allRecommendations];

            if (clientFilter) {
                data = data.filter(rec =>
                    rec.datosAgricultor.nombre.toLowerCase().includes(clientFilter.toLowerCase()) ||
                    rec.datosAgricultor.dni.includes(clientFilter)
                );
            }
            if (statusFilter) {
                data = data.filter(rec => rec.estado === statusFilter);
            }
            if (dateFromFilter) {
                data = data.filter(rec => new Date(rec.fecha) >= new Date(dateFromFilter));
            }
            if (dateToFilter) {
                // Añadimos 1 día a la fecha "hasta" para incluir todo el día
                const toDate = new Date(dateToFilter);
                toDate.setDate(toDate.getDate() + 1);
                data = data.filter(rec => new Date(rec.fecha) < toDate);
            }
            setFilteredData(data);
        };
        applyFilters();
    }, [clientFilter, statusFilter, dateFromFilter, dateToFilter, allRecommendations]);

    const handleClearFilters = () => {
        setClientFilter('');
        setStatusFilter('');
        setDateFromFilter('');
        setDateToFilter('');
    };

    const handleDelete = async (id, nombreCliente) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar la recomendación para "${nombreCliente}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        const toastId = toast.loading('Iniciando eliminación...');

        try {
            // 1. Obtener la recomendación para saber qué imágenes borrar.
            const recToDelete = allRecommendations.find(rec => rec.id === id);
            if (!recToDelete) throw new Error('No se encontró la recomendación para eliminar.');

            // 2. Función para llamar a nuestra Netlify Function y borrar una imagen.
            const deleteImage = async (imageUrl) => {
                if (!imageUrl) return; // Si no hay URL, no hacemos nada.

                // Extraemos el public_id de la URL de Cloudinary.
                const publicId = imageUrl.split('/').pop().split('.')[0];
                const folder = imageUrl.split('/')[imageUrl.split('/').length - 2];
                const fullPublicId = `${folder}/${publicId}`;

                // La URL de la función en Netlify es relativa a la raíz del sitio.
                const response = await fetch('/.netlify/functions/delete-cloudinary-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ publicId: fullPublicId }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.warn(`No se pudo eliminar la imagen ${fullPublicId}:`, errorData.message);
                }
            };

            // 3. Borrar ambas imágenes (si existen).
            toast.loading('Eliminando imágenes de la nube...', { id: toastId });
            await Promise.all([
                deleteImage(recToDelete.seguimiento?.fotoAntes),
                deleteImage(recToDelete.seguimiento?.fotoDespues),
            ]);

            // 4. Borrar el registro de la base de datos (local y luego se sincroniza).
            toast.loading('Eliminando registro de la base de datos...', { id: toastId });
            await deleteRecommendation(id);

            toast.success('Recomendación eliminada con éxito.', { id: toastId });

        } catch (error) {
            console.error('Error en el proceso de eliminación:', error);
            toast.error(`Error al eliminar: ${error.message}`, { id: toastId });
        }
    };

    const handleQuickDateFilter = (days) => {
        const today = new Date();
        const fromDate = new Date();

        if (days === 90) { // "Hace 3 meses"
            fromDate.setMonth(today.getMonth() - 3);
        } else {
            fromDate.setDate(today.getDate() - days);
        }

        // Formatear a YYYY-MM-DD
        const toDateStr = today.toISOString().split('T')[0];
        const fromDateStr = fromDate.toISOString().split('T')[0];

        setDateFromFilter(fromDateStr);
        setDateToFilter(toDateStr);
        // Nota: El filtro se aplica al hacer clic en "Aplicar Filtros"
    };

    // NUEVO: exportar la recomendación seleccionada desde el header
    const handleExportSelected = async () => {
        if (!selectedRecId) {
            toast.error('Selecciona una recomendación para exportar.');
            return;
        }
        if (!pdfLayoutRef.current) {
            toast.error('El contenido para exportar no está listo. Intenta de nuevo.');
            return;
        }

        const rec = filteredData.find(r => r.id === selectedRecId);
        const baseFileName = `recomendacion-${rec.noHoja || rec.localId || Date.now()}`;

        try {
            const t = toast.loading('Generando PDF...');
            await exportElementAsPdf(pdfLayoutRef.current, `${baseFileName}.pdf`);
            toast.dismiss(t);
            toast.success('PDF descargado con éxito.');
        } catch (err) {
            toast.error('Error al generar el PDF.');
            console.error(err);
        }
    };

    // NUEVO: exportar los datos filtrados a Excel
    const handleExportExcel = () => {
        if (filteredData.length === 0) {
            toast.error('No hay datos para exportar a Excel.');
            return;
        }
        try {
            const t = toast.loading('Generando archivo Excel...');
            exportToExcel(filteredData); // Llamamos a la función con los datos actuales
            toast.dismiss(t);
            toast.success('Excel exportado con éxito.');
        } catch (err) {
            toast.error('Hubo un error al generar el archivo Excel.');
            console.error(err);
        }
    };

    if (loading) return <p className="p-4 text-center">Cargando recomendaciones...</p>;
    if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

    return (
        <div className="max-w-7xl mx-auto p-4">
            {/* Renderizar el layout del PDF/Imagen fuera de la pantalla */}
            {/* Solo se renderiza si hay una recomendación seleccionada */}
            {selectedRecId && (
                <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
                    <div ref={pdfLayoutRef}>
                        <RecommendationPdfLayout
                            recommendation={filteredData.find(r => r.id === selectedRecId)}
                        />
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* HEADER DE LA PÁGINA */}
                <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center mb-4 sm:mb-0">                            <img src={logo} alt="Logo AgroGringo" className="h-12 w-12 mr-4 rounded-full object-cover" />
                            <div>
                                <h1 className="text-2xl font-bold">Consulta de Recomendaciones</h1>
                                <p className="text-sm opacity-90">Gestión y Seguimiento</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportExcel}
                                className="btn-export bg-white/20 border-white/30 hover:bg-white/30 border-2 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                            >
                                📊 Excel
                            </button>
                            <button
                                onClick={handleExportSelected}
                                disabled={!selectedRecId}
                                className="btn-export bg-white/20 border-white/30 hover:bg-white/30 border-2 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                📄 PDF
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILTROS */}
                <div className="bg-gray-50 border-b">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full p-4 flex justify-between items-center text-left text-gray-700 font-bold lg:hidden"
                    >
                        <span>
                            <FunnelIcon className="h-5 w-5 inline-block mr-2" />
                            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                        </span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`p-6 ${showFilters ? 'block' : 'hidden'} lg:block`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="filter-label font-semibold text-gray-700 mb-1 block">👤 Cliente (DNI/Nombre)</label>
                                <input type="text" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="filter-input w-full p-2 border-2 border-gray-200 rounded-lg" placeholder="Buscar cliente..." />
                            </div>
                            <div>
                                <label className="filter-label font-semibold text-gray-700 mb-1 block">🔄 Estado</label>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select w-full p-2 border-2 border-gray-200 rounded-lg">
                                    <option value="">Todos</option>
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="En tratamiento">En tratamiento</option>
                                    <option value="Finalizado">Finalizado</option>
                                </select>
                            </div>
                            <div>
                                <label className="filter-label font-semibold text-gray-700 mb-1 block">📅 Desde</label>
                                <input type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)} className="filter-input w-full p-2 border-2 border-gray-200 rounded-lg" />
                            </div>
                            <div>
                                <label className="filter-label font-semibold text-gray-700 mb-1 block">📅 Hasta</label>
                                <input type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)} className="filter-input w-full p-2 border-2 border-gray-200 rounded-lg" />
                            </div>
                        </div>
                        <div className="flex justify-center gap-2 mt-4 text-sm">
                            <button onClick={() => handleQuickDateFilter(1)} className="btn-quick-filter">Último día</button>
                            <button onClick={() => handleQuickDateFilter(30)} className="btn-quick-filter">Últimos 30 días</button>
                            <button onClick={() => handleQuickDateFilter(90)} className="btn-quick-filter">Últimos 3 meses</button>
                            <style>{`
                            .btn-quick-filter { @apply bg-gray-200 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-300; }
                        `}</style>
                        </div>
                        <div className="flex justify-center gap-4 mt-6">
                            <button onClick={handleClearFilters} className="btn-clear-filters bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg">
                                🗑️ Limpiar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RESULTADOS */}
            <div className="p-2 sm:p-4">
                <div className="results-header mb-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-700">Resultados</h2>
                    <div className="results-count font-semibold text-gray-600">
                        <strong>{filteredData.length}</strong> {filteredData.length === 1 ? 'resultado' : 'resultados'}
                    </div>
                </div>

                {/* VISTA DE TABLA (para pantallas grandes) */}
                <div className="hidden lg:block overflow-x-auto bg-white rounded-lg shadow">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-gray-100">
                            <tr className="text-left text-gray-600"><th className="p-3 font-semibold">Sel</th><th className="p-3 font-semibold">N° Hoja</th><th className="p-3 font-semibold">Fecha</th><th className="p-3 font-semibold">Cliente</th><th className="p-3 font-semibold">Estado</th><th className="p-3 font-semibold text-center">Acciones</th></tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? filteredData.map((rec) => (
                                <tr key={rec.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3">
                                        <input
                                            type="radio"
                                            name="selectedRec"
                                            checked={selectedRecId === rec.id}
                                            onChange={() => setSelectedRecId(rec.id)}
                                        />
                                    </td>
                                    <td className="p-3 font-mono font-bold text-green-700">{rec.noHoja}</td>
                                    <td className="p-3">{new Date(rec.fecha).toLocaleDateString()}</td>
                                    <td className="p-3">
                                        <div className="font-semibold">{rec.datosAgricultor.nombre}</div>
                                        <div className="text-xs text-gray-500">DNI: {rec.datosAgricultor.dni}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${estadoStyles[rec.estado] || 'bg-gray-100'}`}>
                                            {rec.estado}
                                        </span>
                                    </td>
                                    <td className="p-3 flex gap-2 justify-center">
                                        <Link to={`/recommendations/${rec.id}`} className="btn-action bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded flex items-center gap-1">👁️ Ver</Link>
                                        <Link to={`/recommendations/${rec.id}/follow-up`} className="btn-action bg-orange-500 hover:bg-orange-600 text-white py-1 px-3 rounded flex items-center gap-1">📸 Seguir</Link>
                                        <Link to={`/recommendations/edit/${rec.id}`} className="btn-action bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded flex items-center gap-1">✏️ Edit</Link>
                                        <button onClick={() => handleDelete(rec.id, rec.datosAgricultor.nombre)} className="btn-action bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded flex items-center gap-1">🗑️ Eliminar</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="text-center p-8 text-gray-500">
                                    <div className="text-4xl mb-2">📋</div>
                                    <h3 className="font-bold text-lg">No se encontraron recomendaciones</h3>
                                    <p>Prueba ajustando los filtros o crea una nueva recomendación.</p>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* VISTA DE TARJETAS (para pantallas pequeñas) */}
                <div className="lg:hidden space-y-4">
                    {filteredData.length > 0 ? filteredData.map((rec) => (
                        <div key={rec.id} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-600">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-gray-800">{rec.datosAgricultor.nombre}</p>
                                    <p className="text-sm text-gray-500">DNI: {rec.datosAgricultor.dni}</p>
                                    <p className="text-sm text-gray-500">Fecha: {new Date(rec.fecha).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                    <p className="font-mono text-sm text-gray-500">Hoja N°</p>
                                    <p className="font-mono font-bold text-lg text-green-700">{rec.noHoja}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-between items-center">
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${estadoStyles[rec.estado] || 'bg-gray-100'}`}>
                                    {rec.estado}
                                </span>
                                <div className="flex gap-2 items-center">
                                    {/* selección en móvil */}
                                    <input type="radio" name="selectedRecMobile" checked={selectedRecId === rec.id} onChange={() => setSelectedRecId(rec.id)} />
                                    <Link to={`/recommendations/${rec.id}`} className="btn-action bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full h-9 w-9 flex items-center justify-center">👁️</Link>
                                    <Link to={`/recommendations/edit/${rec.id}`} className="btn-action bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-full h-9 w-9 flex items-center justify-center">✏️</Link>
                                    <Link to={`/recommendations/${rec.id}/follow-up`} className="btn-action bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full h-9 w-9 flex items-center justify-center">📸</Link>
                                    <button onClick={() => handleDelete(rec.id, rec.datosAgricultor.nombre)} className="btn-action bg-red-600 hover:bg-red-700 text-white p-2 rounded-full h-9 w-9 flex items-center justify-center">🗑️</button>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-lg shadow">
                            <div className="text-4xl mb-2">📋</div>
                            <h3 className="font-bold text-lg">No se encontraron recomendaciones</h3>
                            <p>Prueba ajustando los filtros o crea una nueva recomendación.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}