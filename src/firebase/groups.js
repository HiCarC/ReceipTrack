import { db } from "../firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Create a new group in Firestore.
 * @param {Object} params
 * @param {string} params.name - Group name
 * @param {string} params.emoji - Emoji/icon for the group
 * @param {string} params.createdBy - UID of the creator
 * @param {string[]} params.members - Array of member emails
 */
export async function createGroup({ name, emoji, createdBy, members }) {
  const groupRef = doc(collection(db, "groups"));
  await setDoc(groupRef, {
    id: groupRef.id,
    name,
    emoji: emoji || "👥",
    createdBy,
    members,
    createdAt: serverTimestamp(),
  });
  return groupRef.id;
} 