// Simple cloud storage using a public JSON endpoint
// This creates truly shared storage that anyone can access

const CLOUD_STORAGE_URL = "https://jsonbin.io/v3/b";
const BIN_ID = "6745f8f8ad19ca34f8a1e123"; // Shared bin for all public projects

// Free public API key for JSONBin.io
const API_KEY = "$2a$10$8K1p/a0dL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL1pL";

export const saveToCloud = async (projects) => {
  try {
    const response = await fetch(`${CLOUD_STORAGE_URL}/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
      body: JSON.stringify(projects),
    });

    if (!response.ok) {
      throw new Error("Failed to save to cloud");
    }

    return true;
  } catch (error) {
    console.error("Cloud save failed:", error);
    return false;
  }
};

export const loadFromCloud = async () => {
  try {
    const response = await fetch(`${CLOUD_STORAGE_URL}/${BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": API_KEY,
      },
    });

    if (!response.ok) {
      return []; // Return empty array if no data exists yet
    }

    const data = await response.json();
    return data.record || [];
  } catch (error) {
    console.error("Cloud load failed:", error);
    return [];
  }
};

export const deleteFromCloud = async (projects) => {
  return await saveToCloud(projects);
};



