import { db } from "../database/dexieConfig";
import { db as firestoreDB } from "@/firebase/config";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

/**
 * Obtiene una recomendación por su ID.
 * Primero busca en la base de datos local (Dexie).
 * Si no la encuentra, la busca en Firestore, la guarda en Dexie y la devuelve.
 * @param {string} id El ID de la recomendación a buscar.
 * @returns {Promise<object|null>} La recomendación encontrada o null.
 */
export const getRecommendationById = async (id) => {
  // 1. Intentar obtener desde la base de datos local (Dexie)
  const localData = await db.recommendations.get(id);

  if (localData) {
    console.log("Recomendación encontrada en Dexie:", localData);
    return localData;
  }

  // 2. Si no está en Dexie, buscar en Firestore
  try {
    console.log(
      `Recomendación no encontrada en Dexie. Buscando en Firestore (ID: ${id})...`
    );
    const docRef = doc(firestoreDB, "recommendations", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const firestoreData = docSnap.data();
      console.log("Recomendación encontrada en Firestore:", firestoreData);

      // Convertir Timestamps de Firestore a objetos Date de JS
      const dataToStore = {
        ...firestoreData,
        id: docSnap.id,
        fecha: firestoreData.fecha.toDate(),
        // Aseguramos que el estado de sincronización sea 'synced'
        syncStatus: "synced",
      };

      // 3. Guardar en Dexie para futuras consultas offline
      await db.recommendations.put(dataToStore);
      console.log("Recomendación guardada en Dexie para uso futuro.");

      return dataToStore;
    } else {
      console.warn("La recomendación no existe ni en Dexie ni en Firestore.");
      return null;
    }
  } catch (error) {
    console.error("Error al buscar la recomendación en Firestore:", error);
    throw error; // Relanzamos el error para que la UI pueda manejarlo
  }
};

/**
 * Se suscribe a las actualizaciones en tiempo real de las recomendaciones de un usuario.
 * @param {string} userId - El ID del usuario para filtrar las recomendaciones.
 * @param {function} callback - La función que se llamará con la lista actualizada de recomendaciones.
 * @returns {function} Una función para cancelar la suscripción.
 */
export const onRecommendationsUpdate = (userId, callback) => {
  // Si no hay ID de usuario, no hacemos nada.
  if (!userId) return () => {};

  const q = query(
    collection(firestoreDB, "recommendations"),
    where("userId", "==", userId),
    orderBy("fecha", "desc") // Pedimos los datos ordenados
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const firestoreRecs = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Aseguramos que los datos de Firestore tengan el formato correcto para Dexie
      firestoreRecs.push({
        ...data,
        id: doc.id,
        // Aseguramos que la fecha sea un objeto Date de JS, no un Timestamp de Firebase
        fecha: data.fecha.toDate ? data.fecha.toDate() : new Date(data.fecha),
        syncStatus: "synced", // Marcamos como sincronizado
      });
    });

    // Actualizamos Dexie con inteligencia para evitar conflictos
    db.transaction("rw", db.recommendations, async () => {
      // 1. Actualizar o Insertar datos que vienen de la nube
      for (const remoteRec of firestoreRecs) {
        const localRec = await db.recommendations.get(remoteRec.id);

        // PROTECCIÓN CRÍTICA:
        // Si el registro existe localmente y tiene cambios pendientes (pending, modified, deleted),
        // NO lo sobrescribimos con la versión de la nube. Nuestra versión local es la "verdad" actual.
        if (
          localRec &&
          ["pending", "modified", "deleted"].includes(localRec.syncStatus)
        ) {
          continue;
        }

        // Si no hay conflicto, actualizamos Dexie con la versión de la nube
        await db.recommendations.put(remoteRec);
      }

      // 2. Manejar borrados remotos (Si se borró en la nube, borrarlo localmente)
      // Obtenemos todos los registros locales que creemos que están sincronizados
      const localSyncedRecs = await db.recommendations
        .where("userId")
        .equals(userId)
        .filter((rec) => rec.syncStatus === "synced")
        .toArray();

      // Creamos un Set de IDs que vienen de la nube para búsqueda rápida
      const remoteIds = new Set(firestoreRecs.map((r) => r.id));

      for (const localRec of localSyncedRecs) {
        // Si un registro local "synced" ya no existe en la nube, lo borramos
        if (!remoteIds.has(localRec.id)) {
          await db.recommendations.delete(localRec.id);
        }
      }
    }).catch((err) => {
      console.error("Error al sincronizar snapshot de Firestore a Dexie:", err);
    });

    // El callback original ya no es necesario para la UI, pero lo mantenemos por si se usa en otro lugar.
    if (callback) {
      callback(firestoreRecs);
    }
  });

  return unsubscribe;
};

/**
 * Obtiene las recomendaciones de un usuario directamente desde Dexie.
 * @param {string} userId - El ID del usuario.
 * @returns {Promise<Array>} Una promesa que se resuelve con la lista de recomendaciones locales.
 */
export const getLocalRecommendations = async (userId) => {
  if (!userId) return [];

  const recommendations = await db.recommendations
    .where("userId")
    .equals(userId)
    .toArray();

  // 1. Filtramos los que están marcados como "deleted" para que desaparezcan de la UI inmediatamente
  // 2. Ordenamos por fecha descendente
  return recommendations
    .filter((rec) => rec.syncStatus !== "deleted")
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
};

/**
 * Obtiene la última recomendación para determinar el siguiente número de hoja.
 * @returns {Promise<object|null>} La última recomendación encontrada o null si no hay ninguna.
 */
export const getLastRecommendation = async () => {
  // Ordena todas las recomendaciones por 'noHoja' de forma descendente y toma la primera.
  // Esto asume que 'noHoja' es numérico o un string que se ordena correctamente.
  // Es más fiable que ordenar por fecha si se pueden crear hojas con fechas pasadas.
  const lastRec = await db.recommendations.orderBy("noHoja").reverse().first();
  console.log("Última recomendación encontrada en Dexie:", lastRec);
  return lastRec;
};

/**
 * Crea una nueva recomendación en la base de datos local (Dexie).
 * @param {object} recommendationData Los datos de la nueva recomendación.
 * @returns {Promise<string>} El ID de la recomendación creada.
 */
export const createRecommendation = async (recommendationData, userId) => {
  const newId = uuidv4();
  const recommendation = {
    ...recommendationData,
    id: newId,
    userId: userId, // Aseguramos que el userId se guarde
    syncStatus: "pending", // Marcar como pendiente para sincronizar
    timestampUltimaModificacion: new Date(),
  };
  await db.recommendations.add(recommendation);
  return newId;
};

/**
 * Actualiza una recomendación existente en la base de datos local (Dexie).
 * @param {string} id El ID de la recomendación a actualizar.
 * @param {object} updates Los campos a actualizar.
 * @returns {Promise<number>}
 */
export const updateRecommendation = async (id, updates) => {
  const recommendation = await db.recommendations.get(id);
  if (!recommendation) {
    throw new Error(
      "No se puede actualizar una recomendación que no existe localmente."
    );
  }

  // Si el registro ya estaba sincronizado, lo marcamos como modificado.
  // Si estaba como 'pending', se queda como 'pending'.
  const newSyncStatus =
    recommendation.syncStatus === "synced"
      ? "modified"
      : recommendation.syncStatus;

  return db.recommendations.update(id, {
    ...updates,
    syncStatus: newSyncStatus,
    timestampUltimaModificacion: new Date(),
  });
};

/**
 * Marca una recomendación para ser eliminada en la próxima sincronización.
 * @param {string} id El ID de la recomendación a marcar para eliminar.
 */
export const deleteRecommendation = async (id) => {
  await db.recommendations.update(id, { syncStatus: "deleted" });
};
