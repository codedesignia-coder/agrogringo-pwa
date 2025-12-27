import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller, get } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createRecommendation, getLastRecommendation, getRecommendationById, updateRecommendation } from '@/services/api/recommendations';
import { searchClients } from '@/services/api/clients';
import { getAllProducts } from '@/services/api/products';
import toast from 'react-hot-toast';
import { updateUserProfile } from '@/services/api/userProfiles';
import { SignaturePad } from '@/components/SignaturePad';
import { ProductAutocomplete } from '@/components/ProductAutocomplete';
import { db } from '@/services/database/dexieConfig';
import { compressImage } from '@/utils/imageCompressor';
import logo from '@/assets/logo_agrogringo.jpeg'; // 1. Importamos el logo
import { uploadToCloudinary } from '@/services/cloudinaryUploader';

// Datos geográficos de Ucayali
const ucayaliData = {
    provinces: [
        { name: 'Coronel Portillo', districts: ['Callería', 'Campoverde', 'Iparía', 'Masisea', 'Yarinacocha', 'Nueva Requena', 'Manantay'] },
        { name: 'Atalaya', districts: ['Raimondi', 'Sepahua', 'Tahuanía', 'Yurúa'] },
        { name: 'Padre Abad', districts: ['Padre Abad', 'Irázola', 'Curimaná', 'Alexander von Humboldt', 'Neshuya', 'Huipoca', 'Boqueron'] },
        { name: 'Purús', districts: ['Purús'] }
    ]
};

// Datos para los nuevos campos
const cultivos = ['Cocona', 'Papaya', 'Maíz', 'Maní', 'Cacao', 'Camu Camu', 'Ají', 'Otros'];
const tiposRecomendacion = ['Análisis de suelo', 'Aplicaciones', 'Control Fitosanitario', 'Enmienda', 'Manejo de Arvences', 'Fertilización', 'Labores culturales', 'Podas', 'Recoleccion de Cosecha', 'Otros'];
const fasesTratamiento = ['Siembra', 'Vegetativo', 'Floración', 'Producción', 'Postcosecha', 'Cosecha', 'Otro'];
const unidadesCantidad = ['gr', 'ml', 'kg', 'L', 'unid.'];

export function RecommendationForm() {
    const navigate = useNavigate();
    const { id } = useParams(); // Obtiene el ID de la URL si existe
    const isEditMode = !!id; // True si hay un ID, false si no

    const { user } = useAuth();
    const [clientSearch, setClientSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isFetchingNextSheet, setIsFetchingNextSheet] = useState(true);
    const [productList, setProductList] = useState([]);
    const [distritos, setDistritos] = useState([]);

    const {
        register,
        control,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues: {
            noHoja: '',
            fecha: new Date().toISOString(),
            datosAgricultor: {
                nombre: '',
                dni: '',
                celular: '',
                direccion: '',
                adelanto: 0,
                distrito: '', // Se convertirá en un select
                provincia: '',
                departamento: 'Ucayali',
            },
            datosTecnico: {
                nombre: user?.displayName || 'Nombre del Técnico', // Idealmente vendría del perfil de Firebase
                email: user?.email || '',
                cip: '',
                telefono: '',
            },
            cultivo: '',
            diagnostico: '',
            detallesProductos: [{ producto: '', cantidad: 1, unidad: 'gr', formaUso: '' }],
            estado: 'Pendiente',
            recomendaciones: [], // Ahora será un array de strings seleccionados
            seguimiento: {
                fotoAntes: null,
                fotoDespues: null,
                observaciones: '',
            },
            firmaAgricultor: null,
            firmaTecnico: null,
        },
    });

    // Observamos el valor de la provincia para actualizar los distritos
    const selectedProvincia = watch('datosAgricultor.provincia');

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'detallesProductos',
    });
    // Manejo del envío del formulario
    const onSubmit = async (data) => {
        try {
            // Solo procesa la imagen si es un archivo nuevo (objeto File)
            if (data.seguimiento.fotoAntes instanceof FileList && data.seguimiento.fotoAntes.length > 0) {
                const originalFile = data.seguimiento.fotoAntes[0];
                // Comprimimos la imagen
                const compressedBlob = await compressImage(originalFile);
                // La subimos a Cloudinary y obtenemos la URL
                const imageUrl = await uploadToCloudinary(compressedBlob);
                data.seguimiento.fotoAntes = imageUrl; // Guardamos la URL en lugar del base64
            }

            if (isEditMode) {
                // Lógica de Actualización
                // El ID ya no está en `data` porque no es un campo del formulario. Lo obtenemos de useParams.
                const { noHoja, ...updateData } = data;
                await updateRecommendation(id, updateData);
                toast.success('Recomendación actualizada con éxito!');
                navigate('/');
            } else {
                // Lógica de Creación
                if (!data.seguimiento.fotoAntes) {
                    // Si no se seleccionó archivo, asegúrate de que sea null
                    data.seguimiento.fotoAntes = null;
                }
                // ¡LA SOLUCIÓN! Aseguramos que fotoDespues sea null en la creación.
                // Firestore no acepta 'undefined', que es lo que podría estar enviando el formulario.
                data.seguimiento.fotoDespues = null;

                // La función createRecommendation se encargará de añadir el userId.
                // No es necesario añadirlo manualmente aquí si se pasa como argumento.

                // Guardar la recomendación con la imagen ya convertida
                await createRecommendation(data, user.uid);

                toast.success('Recomendación guardada con éxito!');
                navigate('/'); // Volver a la lista
            }
        } catch (error) {
            toast.error('Hubo un error al guardar la recomendación.');
            console.error(error);
        }
    };
    // Función para buscar clientes
    const handleClientSearch = useCallback(async (query) => {
        if (query.trim().length > 1) {
            setIsSearching(true);
            try {
                const results = await searchClients(query);
                setSearchResults(results);
            } catch (error) {
                console.error("Error searching for clients:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        } else {
            setSearchResults([]);
        }
    }, []);

    // Efecto para buscar clientes con debounce
    useEffect(() => {
        const debounceSearch = setTimeout(() => {
            handleClientSearch(clientSearch);
        }, 300);

        return () => clearTimeout(debounceSearch);
    }, [clientSearch, handleClientSearch]);

    // Efecto para obtener el siguiente número de hoja automáticamente
    useEffect(() => {
        const loadFormData = async () => {
            if (isEditMode) {
                // MODO EDICIÓN: Cargar datos de la recomendación existente
                try {
                    const recommendationData = await getRecommendationById(id);
                    if (recommendationData) {
                        // Usamos reset para poblar todo el formulario con los datos cargados
                        // Si no hay firma de técnico en los datos guardados, intentamos cargar la del perfil
                        if (!recommendationData.firmaTecnico && user) {
                            const userProfile = await db.userProfiles.get(user.uid);
                            if (userProfile?.signature) {
                                recommendationData.firmaTecnico = userProfile.signature;
                            }
                        }
                        reset(recommendationData);
                    } else {
                        toast.error("No se encontró la recomendación para editar.");
                        navigate('/');
                    }
                } catch (error) {
                    toast.error("Error al cargar la recomendación.");
                    navigate('/');
                }
            } else {
                // MODO CREACIÓN: Obtener el siguiente número de hoja
                if (!user) return;
                setIsFetchingNextSheet(true);
                // Cargar la firma por defecto del técnico
                const userProfile = await db.userProfiles.get(user.uid);
                if (userProfile?.signature) {
                    setValue('firmaTecnico', userProfile.signature);
                }

                try {
                    const lastRecommendation = await getLastRecommendation(user.uid);
                    let nextNumber = 1;
                    if (lastRecommendation && lastRecommendation.noHoja) {
                        const lastNumber = parseInt(lastRecommendation.noHoja, 10);
                        if (!isNaN(lastNumber)) {
                            nextNumber = lastNumber + 1;
                        }
                    }
                    setValue('noHoja', nextNumber.toString().padStart(3, '0'));
                } catch (error) {
                    console.error("Error fetching next sheet number:", error);
                    setValue('noHoja', '001'); // Fallback
                } finally {
                    setIsFetchingNextSheet(false);
                }
            }
        };

        loadFormData();

    }, [id, isEditMode, user, navigate, reset, setValue]);

    // Efecto para cargar la lista de productos para el autocompletado
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const products = await getAllProducts();
                setProductList(products);
            } catch (error) {
                console.error("Error fetching product list:", error);
            }
        };
        fetchProducts();
    }, []);

    // Efecto para actualizar los distritos cuando cambia la provincia
    useEffect(() => {
        const provinceData = ucayaliData.provinces.find(p => p.name === selectedProvincia);
        setDistritos(provinceData ? provinceData.districts : []);
        setValue('datosAgricultor.distrito', ''); // Resetea el distrito al cambiar de provincia
    }, [selectedProvincia, setValue]);

    const handleSelectClient = (client) => {
        // Usamos setValue para rellenar todos los campos del agricultor de forma segura
        setValue('datosAgricultor.nombre', client.nombre || '');
        setValue('datosAgricultor.dni', client.dni || '');
        setValue('datosAgricultor.celular', client.celular || '');
        setValue('datosAgricultor.direccion', client.direccion || '');
        setValue('datosAgricultor.departamento', client.departamento || 'Ucayali');
        setValue('datosAgricultor.provincia', client.provincia || '');
        setValue('datosAgricultor.distrito', client.distrito || '');
        setValue('datosAgricultor.adelanto', client.adelanto || 0);
        // ¡Aquí está la magia! Si el cliente tiene una firma guardada, la cargamos.
        if (client.signature) {
            setValue('firmaAgricultor', client.signature);
        }
        // Limpiamos la búsqueda
        setClientSearch('');
        setSearchResults([]);
    };

    const handleProductSelect = (product, index) => {
        // Cuando un producto es seleccionado del autocompletado,
        // rellenamos los campos correspondientes.
        setValue(`detallesProductos.${index}.producto`, product.nombre);
        // Usamos la cantidad del catálogo o 1 si no está definida.
        setValue(`detallesProductos.${index}.cantidad`, parseFloat(product.cantidad) || 1);
        setValue(`detallesProductos.${index}.formaUso`, product.formaDeUso || '');
    };

    const handleSaveTechnicianSignature = async () => {
        const signature = watch('firmaTecnico');
        if (!signature) {
            toast.error('No hay firma para guardar.');
            return;
        }
        if (!user) {
            toast.error('No se pudo identificar al usuario.');
            return;
        }

        try {
            await updateUserProfile(user.uid, { signature });
            toast.success('Firma guardada como predeterminada.');
        } catch (error) {
            toast.error('Error al guardar la firma.');
        }
    };

    // Función para añadir una nueva fila de producto con valores por defecto
    const addProductRow = () => append({ producto: '', cantidad: 1, unidad: 'gr', formaUso: '' });

    return (
        <div className="bg-gray-100 min-h-full">
            <div className="max-w-4xl mx-auto p-2 sm:p-4">
                {/* HEADER */}
                <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-4 sm:p-6 rounded-t-xl shadow-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center mb-4 sm:mb-0">
                            {/* 2. Reemplazamos el emoji por la imagen del logo */}
                            <img src={logo} alt="Logo AgroGringo" className="h-14 w-14 mr-4 rounded-full object-cover" />
                            <div>
                                <h1 className="text-2xl font-bold text-shadow">{isEditMode ? 'EDITAR RECOMENDACIÓN' : 'AGRO GRINGO - AGUAYTIA'}</h1>
                                <p className="font-semibold">HOJA DE RECOMENDACIÓN TÉCNICA</p>
                            </div>
                        </div>
                        <div className="text-right w-full sm:w-auto">
                            <div className="font-bold text-lg">📞 992 431 355</div>
                            <div className="bg-white/25 px-3 py-1 rounded-full text-sm font-bold mt-1">
                                {isFetchingNextSheet ? (
                                    <span className="text-white/70">Cargando N°...</span>
                                ) : (
                                    <input
                                        id="noHoja"
                                        placeholder="N° 001"
                                        {...register('noHoja', { required: 'El N° de hoja es obligatorio' })}
                                        className="bg-transparent text-white placeholder-white/70 text-center outline-none w-28"
                                        readOnly // El número de hoja no se debe cambiar
                                    />
                                )}
                            </div>
                            {errors.noHoja && <p className="mt-1 text-xs text-yellow-300">{errors.noHoja.message}</p>}
                        </div>
                    </div>
                </div>

                {/* SEARCH SECTION */}
                <div className="bg-white p-4 sm:p-6 shadow-lg">
                    <div className="relative flex-grow">
                        <h3 className="text-lg font-bold text-gray-700 mb-3">🔍 Búsqueda Rápida de Cliente</h3>
                        <label htmlFor="clientSearch" className="block text-sm font-medium text-gray-700 sr-only">Buscar Cliente por DNI o Nombre</label>
                        <input
                            id="clientSearch"
                            type="text"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Escribe DNI o nombre para buscar un cliente existente..."
                            className="w-full p-3 border-2 border-gray-200 rounded-lg shadow-sm transition focus:ring-green-500 focus:border-green-500"
                        />
                        {isSearching && <p className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Buscando...</p>}
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                {searchResults.map((client) => (
                                    <li
                                        key={client.dni}
                                        onClick={() => handleSelectClient(client)}
                                        className="px-4 py-3 cursor-pointer hover:bg-green-50 border-b last:border-b-0"
                                    >
                                        <p className="font-semibold text-gray-800">{client.nombre}</p>
                                        <p className="text-sm text-gray-600">{client.dni}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-2 sm:p-6 space-y-6 bg-gray-100 rounded-b-xl">
                    {/* Datos del Agricultor */}
                    <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
                        <h2 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">👨‍🌾 Datos del Agricultor</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <label htmlFor="agricultorNombre" className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                <input
                                    id="agricultorNombre"
                                    {...register('datosAgricultor.nombre', { required: 'El nombre es obligatorio' })}
                                    placeholder="Nombre completo o Razón Social"
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                />
                                {errors.datosAgricultor?.nombre && <p className="mt-1 text-sm text-red-600">{errors.datosAgricultor.nombre.message}</p>}
                            </div>
                            <div>
                                <label htmlFor="agricultorDni" className="block text-sm font-medium text-gray-700">DNI/RUC</label>
                                <input
                                    type="tel"
                                    id="agricultorDni"
                                    {...register('datosAgricultor.dni', { required: 'El DNI/RUC es obligatorio', minLength: { value: 8, message: 'El DNI/RUC debe tener 8 u 11 dígitos' }, maxLength: { value: 11, message: 'El DNI/RUC debe tener 8 u 11 dígitos' } })}
                                    maxLength="11"
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                    placeholder="DNI o RUC"
                                />
                                {errors.datosAgricultor?.dni && <p className="mt-1 text-xs text-red-600">{errors.datosAgricultor.dni.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="agricultorDireccion" className="block text-sm font-medium text-gray-700">Dirección</label>
                                <input
                                    id="agricultorDireccion"
                                    {...register('datosAgricultor.direccion')}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="agricultorCelular" className="block text-sm font-medium text-gray-700">Celular</label>
                                <input
                                    type="tel"
                                    id="agricultorCelular"
                                    maxLength="9"
                                    {...register('datosAgricultor.celular', {
                                        pattern: { value: /^[0-9]{9}$/, message: 'El celular debe tener 9 dígitos' }
                                    })}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                    placeholder="987654321"
                                />
                            </div>
                            <div>
                                <label htmlFor="agricultorProvincia" className="block text-sm font-medium text-gray-700">Provincia</label>
                                <select
                                    id="agricultorProvincia"
                                    {...register('datosAgricultor.provincia')}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                >
                                    <option value="">-- Seleccione --</option>
                                    {ucayaliData.provinces.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="agricultorDistrito" className="block text-sm font-medium text-gray-700">Distrito</label>
                                <select
                                    id="agricultorDistrito"
                                    {...register('datosAgricultor.distrito')}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                    disabled={!selectedProvincia || distritos.length === 0}
                                >
                                    <option value="">-- Seleccione --</option>
                                    {distritos.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="agricultorDepartamento" className="block text-sm font-medium text-gray-700">Departamento</label>
                                <input id="agricultorDepartamento" {...register('datosAgricultor.departamento')} className="w-full p-2 mt-1 bg-gray-200 border-gray-300 rounded-md shadow-sm cursor-not-allowed" readOnly />
                            </div>
                        </div>
                    </section>

                    {/* Datos de la Hoja y Técnico */}
                    <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
                        <h2 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">🧑‍🔬 Representante Técnico</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label htmlFor="tecnicoNombre" className="block text-sm font-medium text-gray-700">Nombre del Técnico</label>
                                <input id="tecnicoNombre" {...register('datosTecnico.nombre')} className="w-full p-2 mt-1 bg-gray-200 border-gray-300 rounded-md shadow-sm cursor-not-allowed" readOnly />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="tecnicoEmail" className="block text-sm font-medium text-gray-700">Email del Técnico</label>
                                <input id="tecnicoEmail" {...register('datosTecnico.email')} className="w-full p-2 mt-1 bg-gray-200 border-gray-300 rounded-md shadow-sm cursor-not-allowed" readOnly />
                            </div>
                            <div>
                                <label htmlFor="tecnicoCip" className="block text-sm font-medium text-gray-700">CIP</label>
                                <input id="tecnicoCip" {...register('datosTecnico.cip')} className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500" />
                            </div>
                            <div>
                                <label htmlFor="tecnicoTelefono" className="block text-sm font-medium text-gray-700">Teléfono</label>
                                <input
                                    type="tel"
                                    id="tecnicoTelefono"
                                    maxLength="9"
                                    {...register('datosTecnico.telefono', {
                                        pattern: { value: /^[0-9]{9}$/, message: 'El teléfono debe tener 9 dígitos' }
                                    })}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                />
                                {errors.datosTecnico?.telefono && <p className="mt-1 text-xs text-red-600">{errors.datosTecnico.telefono.message}</p>}
                            </div>
                        </div>
                    </section>

                    {/* Diagnóstico */}
                    <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
                        <h2 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">🔬 Diagnóstico en Cultivo</h2>                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label htmlFor="cultivo" className="block text-sm font-medium text-gray-700">Cultivo de:</label>
                                <select
                                    id="cultivo"
                                    {...register('cultivo', { required: 'Seleccione un cultivo' })}
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                >
                                    <option value="">-- Seleccione --</option>
                                    {cultivos.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {errors.cultivo && <p className="mt-1 text-sm text-red-600">{errors.cultivo.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="diagnostico" className="block text-sm font-medium text-gray-700">Descripción del Diagnóstico</label>
                                <textarea
                                    id="diagnostico"
                                    {...register('diagnostico', { required: 'El diagnóstico es obligatorio' })}
                                    rows="3"
                                    className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                    placeholder="Describe el problema, plaga o enfermedad encontrada..."
                                ></textarea>
                            </div>
                        </div>
                        {errors.diagnostico && <p className="mt-1 text-sm text-red-600">{errors.diagnostico.message}</p>}
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700">Foto del Cultivo (Antes)</label>
                            <input type="file" accept="image/*" {...register('seguimiento.fotoAntes')} className="w-full mt-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                            <p className="mt-1 text-xs text-gray-500">Esta foto se guardará para el seguimiento.</p>
                        </div>
                    </section>

                    {/* Detalles de Productos */}
                    <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="bg-green-800 text-white p-4 flex justify-between items-center rounded-t-lg">
                            <h2 className="text-lg font-bold flex items-center gap-2">📦 Productos Recomendados</h2>
                            <button
                                type="button"
                                onClick={addProductRow}
                                className="bg-white text-green-800 font-bold py-1 px-3 rounded-full text-sm hover:bg-green-100 transition"
                            >
                                + Agregar
                            </button>
                        </div>
                        {/* --- VISTA DE TABLA PARA ESCRITORIO --- */}
                        <table className="w-full hidden md:table">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-2/5">Producto</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-1/4">Cantidad</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-2/5">Dosis / Instrucciones</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map((field, index) => (
                                    <tr key={field.id} className="border-b last:border-0 align-top">
                                        <td className="p-2">
                                            {/* Usamos Controller para integrar el componente de autocompletado */}
                                            <Controller
                                                name={`detallesProductos.${index}.producto`}
                                                control={control}
                                                rules={{ required: 'El producto es obligatorio' }}
                                                render={({ field }) => (
                                                    // Pasamos una función onSelect para manejar el autocompletado
                                                    <ProductAutocomplete
                                                        products={productList}
                                                        value={field.value}
                                                        onChange={(value) => field.onChange(value)}
                                                        onSelect={(product) => handleProductSelect(product, index)}
                                                    />
                                                )}
                                            />
                                            {errors.detallesProductos?.[index]?.producto && <p className="mt-1 text-xs text-red-500">{errors.detallesProductos[index].producto.message}</p>}
                                        </td>
                                        <td className="p-2">
                                            <div className="flex items-center gap-1">
                                                <Controller
                                                    name={`detallesProductos.${index}.cantidad`}
                                                    control={control}
                                                    rules={{ required: 'Requerido', valueAsNumber: true, min: { value: 0.01, message: '> 0' } }}
                                                    render={({ field }) => (
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            {...field}
                                                            className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                                        />
                                                    )}
                                                />
                                                <Controller
                                                    name={`detallesProductos.${index}.unidad`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <select {...field} className="p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500">
                                                            {unidadesCantidad.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    )}
                                                />
                                            </div>
                                            {errors.detallesProductos?.[index]?.cantidad && (
                                                <p className="mt-1 text-xs text-red-500">{errors.detallesProductos[index].cantidad.message}</p>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <Controller
                                                name={`detallesProductos.${index}.formaUso`}
                                                control={control}
                                                render={({ field }) => (
                                                    <input
                                                        {...field}
                                                        className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                                        placeholder="Ej: 1 sobre por mochila de 20L"
                                                    />
                                                )}
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 font-bold text-xl">
                                                &times;
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* --- VISTA DE TARJETAS PARA MÓVIL --- */}
                        <div className="md:hidden p-2 space-y-3 bg-gray-50">
                            {fields.map((field, index) => (
                                <div key={field.id} className="p-3 border rounded-lg bg-white shadow-sm relative">
                                    <p className="font-bold text-sm text-gray-800 mb-2">Producto #{index + 1}</p>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-600">Nombre</label>
                                            <Controller
                                                name={`detallesProductos.${index}.producto`}
                                                control={control}
                                                rules={{ required: 'El producto es obligatorio' }}
                                                render={({ field }) => (
                                                    <ProductAutocomplete
                                                        products={productList}
                                                        value={field.value}
                                                        onChange={(value) => field.onChange(value)}
                                                        onSelect={(product) => handleProductSelect(product, index)}
                                                    />
                                                )}
                                            />
                                            {errors.detallesProductos?.[index]?.producto && <p className="mt-1 text-xs text-red-500">{errors.detallesProductos[index].producto.message}</p>}
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600">Cantidad y Unidad</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Controller
                                                    name={`detallesProductos.${index}.cantidad`}
                                                    control={control}
                                                    rules={{ required: 'Requerido', valueAsNumber: true, min: { value: 0.01, message: '> 0' } }}
                                                    render={({ field }) => (
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            {...field}
                                                            className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                                        />
                                                    )}
                                                />
                                                <Controller
                                                    name={`detallesProductos.${index}.unidad`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <select {...field} className="p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500">
                                                            {unidadesCantidad.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    )}
                                                />
                                            </div>
                                            {errors.detallesProductos?.[index]?.cantidad && (
                                                <p className="mt-1 text-xs text-red-500">{errors.detallesProductos[index].cantidad.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600">Dosis / Instrucciones</label>
                                            <Controller
                                                name={`detallesProductos.${index}.formaUso`}
                                                control={control}
                                                render={({ field }) => (
                                                    <input
                                                        {...field}
                                                        className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                                        placeholder="Ej: 1 sobre por mochila de 20L"
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-2xl leading-none">&times;</button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Recomendaciones de Seguridad */}
                    <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
                        <h2 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">💡 Recomendación</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {tiposRecomendacion.map((rec) => (
                                <div key={rec} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`rec-${rec}`}
                                        value={rec}
                                        {...register('recomendaciones')}
                                        className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                    <label htmlFor={`rec-${rec}`} className="ml-2 block text-sm text-gray-900">
                                        {rec}
                                    </label>
                                </div>
                            ))}
                        </div>
                        {errors.recomendaciones && <p className="mt-2 text-sm text-red-600">{errors.recomendaciones.message}</p>}
                    </section>

                    {/* Seguimiento Inicial y Firmas */}
                    <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border">
                        <h2 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">✍️ Evidencia y Firmas</h2>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Adelanto (S/.)</label>
                                <input type="number" step="0.01" {...register('datosAgricultor.adelanto', { valueAsNumber: true })} className="w-full p-2 mt-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500" />
                            </div>
                            {/* Integración del SignaturePad para el Agricultor */}
                            <Controller
                                name="firmaAgricultor"
                                control={control}
                                render={({ field }) => (
                                    <SignaturePad
                                        title="Firma del Agricultor"
                                        // Aseguramos que solo se guarde la URL de la imagen
                                        initialDataURL={watch('firmaAgricultor')}
                                        onEnd={(signatureDataUrl) => field.onChange(signatureDataUrl)}
                                    />
                                )}
                            />
                            {/* Integración del SignaturePad para el Técnico */}
                            <Controller
                                name="firmaTecnico"
                                control={control}
                                render={({ field }) => (
                                    // Agrupamos el pad y el botón para que JSX sea válido
                                    <div>
                                        <SignaturePad
                                            title="Firma del Técnico"
                                            initialDataURL={watch('firmaTecnico')}
                                            onEnd={(signatureDataUrl) => field.onChange(signatureDataUrl)}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSaveTechnicianSignature}
                                            className="w-full mt-2 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded"
                                        >
                                            Guardar como firma predeterminada
                                        </button>
                                    </div>
                                )}
                            />
                        </div>
                    </section>

                    {/* Botón de Guardar */}
                    <div className="flex justify-center sm:justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto btn btn-save flex items-center justify-center gap-2 px-8 py-3 text-lg font-bold text-white rounded-lg bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:bg-gray-400 disabled:shadow-none disabled:transform-none"
                        >
                            💾
                            <span>{isSubmitting ? 'Guardando...' : 'Guardar Hoja'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
