import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { getRecommendationById, updateRecommendation } from '@/services/api/recommendations';
import { compressImage } from '@/utils/imageCompressor';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/services/cloudinaryUploader';
import { deleteCloudinaryImage } from '@/services/imageDeletionService';
const fasesTratamiento = ['Siembra', 'Vegetativo', 'Floración', 'Producción', 'Postcosecha', 'Cosecha', 'Otro'];

export function FollowUpPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            estado: '',
            faseTratamiento: '',
            seguimiento: {
                fotoDespues: null,
                observaciones: '',
            }
        }
    });

    const estadoActual = watch('estado');
    const faseActual = watch('faseTratamiento');

    useEffect(() => {
        const fetchRecommendation = async () => {
            try {
                setLoading(true);
                const data = await getRecommendationById(id);
                if (data) {
                    setRecommendation(data);
                    // Cargar datos existentes en el formulario
                    setValue('estado', data.estado);
                    setValue('faseTratamiento', data.faseTratamiento || '');
                    setValue('seguimiento.observaciones', data.seguimiento?.observaciones || '');
                } else {
                    setError('No se encontró la recomendación.');
                }
            } catch (err) {
                setError('Error al cargar los datos.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecommendation();
    }, [id, setValue]);

    const onSubmit = async (data) => {
        let oldImageUrlToDelete = null; // Variable para guardar la URL de la imagen vieja

        try {
            const updates = {
                estado: data.estado,
                faseTratamiento: data.estado === 'En tratamiento' ? data.faseTratamiento : '', // Solo guarda la fase si el estado es 'En tratamiento'
                seguimiento: {
                    ...recommendation.seguimiento, // Mantenemos fotoAntes y otros datos
                    observaciones: data.seguimiento.observaciones,
                }
            };

            // Procesar la imagen "fotoDespues" si se ha añadido
            if (data.seguimiento.fotoDespues && data.seguimiento.fotoDespues.length > 0) {
                const originalFile = data.seguimiento.fotoDespues[0];

                // 2. Guardamos la URL de la imagen vieja para borrarla DESPUÉS
                if (recommendation.seguimiento?.fotoDespues) {
                    oldImageUrlToDelete = recommendation.seguimiento.fotoDespues;
                }

                const toastId = toast.loading('Subiendo nueva imagen...', { id: 'uploading' });
                const compressedBlob = await compressImage(originalFile);
                const imageUrl = await uploadToCloudinary(compressedBlob);
                toast.dismiss('uploading');

                updates.seguimiento.fotoDespues = imageUrl;
            } else {
                // Asegurarnos de que fotoDespues no sea undefined si no se sube una nueva imagen.
                updates.seguimiento.fotoDespues = recommendation.seguimiento?.fotoDespues || null;
            }

            await updateRecommendation(id, updates);
            toast.success('Seguimiento guardado con éxito.');

            // 3. Si todo salió bien y hay una imagen vieja, la eliminamos
            if (oldImageUrlToDelete) {
                try {
                    await deleteCloudinaryImage(oldImageUrlToDelete);
                    console.log('Imagen antigua eliminada de Cloudinary exitosamente.');
                } catch (deleteError) {
                    console.warn('No se pudo eliminar la imagen antigua de Cloudinary:', deleteError);
                    toast.error('No se pudo eliminar la imagen antigua, pero el seguimiento se guardó.');
                }
            }

            navigate('/'); // Volver a la lista
        } catch (err) {
            toast.error('Error al guardar el seguimiento.');
            console.error(err);
        }
    };

    if (loading) return <p className="p-4 text-center">Cargando...</p>;
    if (error) return <p className="p-4 text-center text-red-500">{error}</p>;
    if (!recommendation) return null;

    return (
        <div className="bg-gray-100 min-h-full">
            <div className="max-w-2xl mx-auto p-2 sm:p-4">
                <div className="bg-gradient-to-r from-orange-600 to-yellow-500 text-white p-4 sm:p-6 rounded-t-xl shadow-lg">
                    <h1 className="text-2xl font-bold">Seguimiento de Recomendación</h1>
                    <p>Cliente: <strong>{recommendation.datosAgricultor.nombre}</strong> (Hoja N° {recommendation.noHoja})</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-6 bg-white rounded-b-xl shadow-lg">
                    {/* Sección de Estado */}
                    <section className="p-4 bg-gray-50 rounded-lg border space-y-4">
                        <div>
                            <label htmlFor="estado" className="block text-sm font-medium text-gray-700">Cambiar Estado</label>
                            <select
                                id="estado"
                                {...register('estado')}
                                className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="Pendiente">Pendiente</option>
                                <option value="En tratamiento">En tratamiento</option>
                                <option value="Finalizado">Finalizado</option>
                            </select>
                        </div>

                        {/* Campo Condicional para Fase de Tratamiento */}
                        {estadoActual === 'En tratamiento' && (
                            <div className="animate-fade-in">
                                <label htmlFor="faseTratamiento" className="block text-sm font-medium text-gray-700">Fase del Tratamiento</label>
                                <select
                                    id="faseTratamiento"
                                    {...register('faseTratamiento')}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                >
                                    <option value="">-- Seleccione Fase --</option>
                                    {fasesTratamiento.map(fase => <option key={fase} value={fase}>{fase}</option>)}
                                </select>

                                {faseActual === 'Otro' && (
                                    <div className="mt-2">
                                        <label htmlFor="faseTratamientoOtro" className="block text-sm font-medium text-gray-700">Especificar otra fase</label>
                                        <input
                                            id="faseTratamientoOtro"
                                            {...register('faseTratamiento')} // Se registra en el mismo campo
                                            placeholder="Escriba la fase personalizada"
                                            className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500" />
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Sección de Finalización (solo si el estado es 'Finalizado') */}
                    {estadoActual === 'Finalizado' && (
                        <section className="p-4 bg-green-50 rounded-lg border border-green-200 animate-fade-in">
                            <h2 className="text-lg font-bold text-green-800 mb-4">Completar Tratamiento</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">📸 Foto del Cultivo (Después)</label>
                                    <input type="file" accept="image/*" {...register('seguimiento.fotoDespues')} className="w-full mt-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200" />
                                    {recommendation.seguimiento?.fotoDespues && <p className="text-xs text-gray-500 mt-1">Ya existe una foto. Subir una nueva la reemplazará.</p>}
                                </div>
                                <div>
                                    <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700">📝 Observaciones Finales</label>
                                    <textarea
                                        id="observaciones"
                                        {...register('seguimiento.observaciones')}
                                        rows="4"
                                        className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                        placeholder="Resultados observados, comentarios del cliente, etc."
                                    ></textarea>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Botones de Acción */}
                    <div className="flex flex-col-reverse sm:flex-row justify-between items-center pt-4 gap-4">
                        <Link
                            to="/"
                            className="w-full sm:w-auto text-center btn btn-back bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto btn btn-save bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400"
                        >
                            {isSubmitting ? 'Guardando...' : 'Guardar Seguimiento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>

    );
}