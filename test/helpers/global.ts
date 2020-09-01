export const SERVER_ROOT = process.env.SERVER_ROOT || "https://localhost:8443";
export const USERNAME = process.env.USERNAME || "alice";
export const PASSWORD = process.env.PASSWORD || "123";

export function generateTestFolder() {
  const testFolder = `solid-crud-tests-${new Date().getTime()}`;
  return {
    testFolder,
    testFolderUrl: `${SERVER_ROOT}/${testFolder}/`
  };
}