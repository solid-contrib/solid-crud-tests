export const SERVER_ROOT = process.env.SERVER_ROOT || "https://localhost:8443";
export const USERNAME = process.env.USERNAME || "alice";
export const PASSWORD = process.env.PASSWORD || "123";
export const TEST_FOLDER = `solid-crud-tests-${new Date().getTime()}`;
export const testFolderUrl = `${SERVER_ROOT}/${TEST_FOLDER}/`;