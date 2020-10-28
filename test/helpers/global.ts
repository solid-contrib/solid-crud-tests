export const SERVER_ROOT = process.env.SERVER_ROOT || "https://localhost:8443";
export const STORAGE_ROOT = process.env.STORAGE_ROOT || process.env.SERVER_ROOT;

export function generateTestFolder() {
  const testFolder = `solid-crud-tests-${new Date().getTime()}`;
  return {
    testFolder,
    testFolderUrl: `${STORAGE_ROOT}/${testFolder}/`
  };
}
