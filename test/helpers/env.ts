export const oidcIssuer =
  process.env.SERVER_ROOT ||
  process.env.OIDC_ISSUER ||
  "https://localhost:8443";
export const cookie = process.env.COOKIE || process.env.COOKIE_ALICE || "";
export const appOrigin = "https://tester";
export const storageRoot = process.env.STORAGE_ROOT || process.env.SERVER_ROOT;
export const aliceWebId = process.env.ALICE_WEBID;

export function generateTestFolder() {
  const testFolder = `solid-crud-tests-${new Date().getTime()}`;
  return {
    testFolder,
    testFolderUrl: `${storageRoot}/${testFolder}/`,
  };
}
