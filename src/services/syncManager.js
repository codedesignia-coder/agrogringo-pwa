import { db } from "./database/dexieConfig";
import { db as firestoreDB } from "@/firebase/config";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { deleteCloudinaryImage } from "./imageDeletionService"; // 1. Importamos el servicio de eliminación

/**
 * Función de limpieza recursiva.
 * Recorre un objeto y reemplaza cualquier valor `undefined` con `null`.
 * Firestore no permite `undefined`, pero sí `null`.
 * @param {object} obj El objeto a limpiar.
 * @returns {object} El objeto limpio.
 */
const sanitizeDataForFirestore = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  const newObj = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      newObj[key] =
        value === undefined ? null : sanitizeDataForFirestore(value);
    }
  }
  return newObj;
};

// --- Funciones de Interacción con Firestore ---

const createFirestoreRecommendation = async (rec) => {
  // Quitamos el estado de sincronización local antes de subirlo
  const { syncStatus, ...dataToSync } = rec;
  const sanitizedData = sanitizeDataForFirestore(dataToSync); // ¡LIMPIEZA!
  const docRef = doc(firestoreDB, "recommendations", rec.id);
  await setDoc(docRef, {
    // Usamos los datos limpios
    ...sanitizedData,
    fecha: new Date(rec.fecha), // Aseguramos que sea un objeto Date de Firebase
    timestampUltimaModificacion: serverTimestamp(),
  });
};

const updateFirestoreRecommendation = async (rec) => {
  const { syncStatus, ...dataToSync } = rec;
  const sanitizedData = sanitizeDataForFirestore(dataToSync); // ¡LIMPIEZA!
  const docRef = doc(firestoreDB, "recommendations", rec.id);
  await updateDoc(docRef, {
    // Usamos los datos limpios
    ...sanitizedData,
    timestampUltimaModificacion: serverTimestamp(),
  });
};

const deleteFirestoreRecommendation = async (id) => {
  const docRef = doc(firestoreDB, "recommendations", id);
  await deleteDoc(docRef);
};

// --- Motor Principal de Sincronización ---

let isSyncing = false; // Un seguro para evitar sincronizaciones múltiples al mismo tiempo

/**
 * Ejecuta el proceso de sincronización. Busca en la base de datos local
 * los registros pendientes y los sube a Firestore.
 */
export const runSync = async () => {
  if (isSyncing) {
    console.log("Sincronización ya en progreso. Omitiendo.");
    return;
  }

  isSyncing = true;
  console.log("🚀 Iniciando sincronización...");
  const toastId = toast.loading("Sincronizando datos pendientes...");

  try {
    const pendingRecs = await db.recommendations
      .where("syncStatus")
      .notEqual("synced")
      .toArray();

    if (pendingRecs.length === 0) {
      console.log("✅ No hay datos pendientes para sincronizar.");
      toast.dismiss(toastId);
      return;
    }

    for (const rec of pendingRecs) {
      if (rec.syncStatus === "pending" || rec.syncStatus === "modified") {
        await createFirestoreRecommendation(rec); // setDoc maneja creación y sobreescritura
        await db.recommendations.update(rec.id, { syncStatus: "synced" });
      } else if (rec.syncStatus === "deleted") {
        // Antes de eliminar de Firestore, intentamos eliminar las imágenes de Cloudinary
        const imagesToDelete = [
          rec.imageUrl,
          rec.seguimiento?.fotoAntes,
          rec.seguimiento?.fotoDespues,
        ].filter(Boolean);

        for (const imageUrl of imagesToDelete) {
          try {
            await deleteCloudinaryImage(imageUrl);
            console.log(
              `Imagen ${imageUrl} de Cloudinary eliminada para rec.id: ${rec.id}`
            );
          } catch (imageDeleteError) {
            // Si la eliminación de la imagen falla, solo advertimos en la consola pero no detenemos el proceso.
            console.warn(
              `No se pudo eliminar la imagen ${imageUrl} de Cloudinary para rec.id: ${rec.id}. Error: ${imageDeleteError.message}`
            );
          }
        }
        await deleteFirestoreRecommendation(rec.id);
        await db.recommendations.delete(rec.id); // Eliminamos el registro local permanentemente
      }
    }

    toast.success(
      `Sincronización completada. ${pendingRecs.length} registros actualizados.`,
      { id: toastId }
    );
    console.log(
      `✅ Sincronización completada. ${pendingRecs.length} registros procesados.`
    );
  } catch (error) {
    console.error("❌ Error durante la sincronización:", error);
    toast.error("Error durante la sincronización. Revisa la consola.", {
      id: toastId,
    });
  } finally {
    isSyncing = false;
  }
};
