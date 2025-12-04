import { db } from "../database/dexieConfig";
import { db as firestoreDB } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
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
 * Crea una nueva recomendación en la base de datos local (Dexie).
 * @param {object} recommendationData Los datos de la nueva recomendación.
 * @returns {Promise<string>} El ID de la recomendación creada.
 */
export const createRecommendation = async (recommendationData) => {
  const newId = uuidv4();
  const recommendation = {
    ...recommendationData,
    id: newId,
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
