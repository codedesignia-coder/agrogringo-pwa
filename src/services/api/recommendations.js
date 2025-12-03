import { db } from "@/services/database/dexieConfig";
import { v4 as uuidv4 } from "uuid";
import { putClient } from "./clients";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db as firestoreDB } from "@/firebase/config"; // Asegúrate que la ruta a tu config de firebase es correcta
import toast from "react-hot-toast";

/**
 * Crea una nueva recomendación.
 * Por ahora, implementa la lógica offline-first: siempre guarda en Dexie.
 * @param {object} recommendationData - Los datos del formulario.
 * @returns {Promise<number>} El ID local del nuevo registro en Dexie.
 */
export const createRecommendation = async (recommendationData, userId) => {
  try {
    const newRecommendation = {
      ...recommendationData, // Datos del formulario
      id: uuidv4(), // ¡CLAVE! Generamos un ID único universal en la creación.
      dniAgricultor: recommendationData.datosAgricultor?.dni || "",
      userId: userId,
      emailTecnico: recommendationData.datosTecnico?.email || "",
      fecha: new Date(), // Sello de tiempo de creación
      syncStatus: "pending", // Estado inicial para sincronización
      timestampUltimaModificacion: new Date(),
    };

    // Guardar en la base de datos local
    const id = await db.recommendations.add(newRecommendation);

    // Guardar/Actualizar el cliente en su propia tabla para futuras búsquedas
    if (recommendationData.datosAgricultor?.dni) {
      const clientData = { ...recommendationData.datosAgricultor };
      // Si hay una firma, la añadimos al perfil del cliente.
      if (recommendationData.firmaAgricultor) {
        clientData.signature = recommendationData.firmaAgricultor;
      }
      await putClient(clientData);
    }

    console.log("Recomendación guardada localmente con ID:", id);
    return id;
  } catch (error) {
    console.error("Error al guardar la recomendación localmente:", error);
    throw error;
  }
};

/**
 * Obtiene todas las recomendaciones de la base de datos local.
 * Implementa paginación para un rendimiento óptimo con grandes volúmenes de datos.
 * @param {string} userId - El ID del usuario.
 * @param {number} [page=1] - El número de página a obtener.
 * @param {number} [pageSize=15] - El número de elementos por página.
 * @param {object} [filters={}] - Objeto con filtros a aplicar (status, dateFrom, dateTo, client).
 * @returns {Promise<{data: Array<object>, total: number}>} Un objeto con las recomendaciones y el conteo total.
 */
export const getAllRecommendations = async (
  userId,
  page = 1,
  pageSize = 15,
  filters = {}
) => {
  if (!userId || typeof userId !== "string") {
    return { data: [], total: 0 };
  }

  const offset = (page - 1) * pageSize;

  // Empezamos la consulta filtrando por usuario
  let query = db.recommendations
    .where({ userId: userId })
    .and((rec) => rec.syncStatus !== "pending_deletion"); // Ocultamos las que están marcadas para borrar

  // Aplicamos los filtros adicionales si existen
  if (filters.status) {
    query = query.and((rec) => rec.estado === filters.status);
  }
  if (filters.dateFrom) {
    query = query.and((rec) => rec.fecha >= new Date(filters.dateFrom));
  }
  if (filters.dateTo) {
    // Añadimos un día para incluir todo el día de la fecha "hasta"
    const dateTo = new Date(filters.dateTo);
    dateTo.setDate(dateTo.getDate() + 1);
    query = query.and((rec) => rec.fecha < dateTo);
  }
  if (filters.client) {
    const lowerCaseFilter = filters.client.toLowerCase();
    query = query.and(
      (rec) =>
        rec.datosAgricultor.nombre.toLowerCase().includes(lowerCaseFilter) ||
        rec.datosAgricultor.dni.includes(lowerCaseFilter)
    );
  }

  const total = await query.count();
  const data = await query.reverse().offset(offset).limit(pageSize).toArray();

  return { data, total };
};

/**
 * Obtiene la última recomendación registrada para un usuario específico.
 * Esta función está ahora altamente optimizada.
 * @param {string} userId - El ID del usuario.
 * @returns {Promise<object|undefined>} La última recomendación o undefined si no hay ninguna.
 */
export const getLastRecommendation = async (userId) => {
  // Ya no podemos usar .last() directamente porque la clave primaria es un UUID no secuencial.
  // Debemos ordenar explícitamente por fecha para encontrar la última recomendación real.
  // El índice [userId+fecha] que definimos en dexieConfig hace que esta operación sea muy eficiente.
  return await db.recommendations
    .where({ userId: userId })
    .sortBy("fecha")
    .then((recs) => recs[recs.length - 1]);
};

/**
 * Obtiene una recomendación específica por su ID local.
 * @param {string} id - El ID universal (UUID) del registro.
 * @returns {Promise<object|undefined>} La recomendación o undefined si no se encuentra.
 */
export const getRecommendationById = async (id) => {
  // Dexie's get() es la forma más eficiente de obtener un registro por su clave primaria.
  return await db.recommendations.get(id);
};

/**
 * Actualiza una recomendación existente en la base de datos local.
 * @param {string} id - El ID universal (UUID) del registro.
 * @param {object} updates - Un objeto con los campos a actualizar.
 * @returns {Promise<number>} El número de registros actualizados (debería ser 1).
 */
export const updateRecommendation = async (id, updates) => {
  try {
    const recommendation = await db.recommendations.get(id);
    if (!recommendation) {
      throw new Error("Recomendación no encontrada");
    }

    // Prepara los datos para la actualización
    const dataToUpdate = {
      ...updates,
      timestampUltimaModificacion: new Date(),
      // Si ya estaba sincronizado, lo marcamos para actualizar. Si no, sigue pendiente.
      syncStatus:
        recommendation.syncStatus === "synced" ? "modified" : "pending",
    };

    // Al actualizar, también actualizamos el perfil del cliente con la firma más reciente si existe
    // --- CORRECCIÓN ---
    // Nos aseguramos de que el DNI exista y tenga una longitud válida antes de intentar guardar el cliente.
    // Un DNI vacío ("") causaría un error en Dexie.
    if (
      updates.datosAgricultor?.dni &&
      (updates.datosAgricultor.dni.length === 8 ||
        updates.datosAgricultor.dni.length === 11)
    ) {
      const clientData = {
        ...recommendation.datosAgricultor,
        ...updates.datosAgricultor,
      };
      // Si hay una firma en la actualización, la guardamos en el perfil del cliente.
      if (updates.firmaAgricultor) {
        clientData.signature = updates.firmaAgricultor;
      }
      await putClient(clientData);
    }

    return await db.recommendations.update(id, dataToUpdate);
  } catch (error) {
    console.error("Error al actualizar la recomendación localmente:", error);
    throw error;
  }
};

/**
 * Elimina una recomendación de la base de datos local.
 * @param {string} id - El ID universal (UUID) del registro.
 * @returns {Promise<void>}
 */
export const deleteRecommendation = async (id) => {
  const recommendation = await db.recommendations.get(id);
  if (recommendation) {
    // Implementamos Soft Delete (eliminación lógica).
    // En lugar de borrar, marcamos el registro para que el sincronizador lo elimine del servidor
    // y luego lo oculte de la UI local.
    return await db.recommendations.update(id, {
      syncStatus: "deleted",
    });
  }
};

/**
 * Limpia la tabla de recomendaciones.
 */
export const clearLocalDatabase = async () => {
  return await db.recommendations.clear();
};

/**
 * Se suscribe a las actualizaciones en tiempo real de las recomendaciones de un usuario desde Firestore.
 *
 * @param {string} userId - El ID del usuario técnico.
 * @param {function} callback - Una función que se llamará cada vez que los datos cambien.
 *                              Recibirá un array de recomendaciones como argumento.
 * @returns {function} Una función para cancelar la suscripción (unsubscribe).
 */
export const onRecommendationsUpdate = (userId, callback) => {
  if (!userId) {
    // Devuelve una función vacía si no hay usuario para evitar errores.
    return () => {};
  }

  const recommendationsRef = collection(firestoreDB, "recommendations");
  // La consulta ahora debe buscar por 'userId' en lugar de 'tecnicoId' para ser consistente
  const q = query(
    recommendationsRef,
    where("userId", "==", userId),
    orderBy("fecha", "desc")
  );

  // onSnapshot establece la escucha en tiempo real.
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const recommendationsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Aseguramos que la fecha sea un objeto Date de JS para consistencia
        fecha: doc.data().fecha.toDate(),
      }));
      // Llama a la función callback con los datos actualizados.
      callback(recommendationsData);
    },
    (error) => {
      // Manejo de errores de la escucha
      console.error("Error en la suscripción a las recomendaciones:", error);
      toast.error("No se pudo conectar para recibir actualizaciones en vivo.");
    }
  );

  // Devuelve la función para poder detener la escucha cuando el componente se desmonte.
  return unsubscribe;
};
