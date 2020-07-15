
import "reflect-metadata";
import IsomorphicJoseUtility from "solid-auth-fetcher/dist/jose/IsomorphicJoseUtility";
import IssuerConfigFetcher, {
  IIssuerConfigFetcher
} from "solid-auth-fetcher/dist/login/oidc/IssuerConfigFetcher";
import TokenRequester from "solid-auth-fetcher/dist/login/oidc/TokenRequester";
import StorageUtility, {
  IStorageUtility
} from "solid-auth-fetcher/dist/localStorage/StorageUtility";
import fetch from "isomorphic-fetch";
import * as URL from "url-parse";
import DpopHeaderCreator, {
  IDpopHeaderCreator
} from "solid-auth-fetcher/dist/dpop/DpopHeaderCreator";
import UuidGenerator from "solid-auth-fetcher/dist/util/UuidGenerator";
import { IDpopClientKeyManager } from "solid-auth-fetcher/dist/dpop/DpopClientKeyManager";
import { JSONWebKey } from "jose";
import ClientRegistrar from "solid-auth-fetcher/dist/login/oidc/ClientRegistrar";
import IJoseUtility from "solid-auth-fetcher/dist/jose/IJoseUtility";
import Fetcher, { IFetcher } from "solid-auth-fetcher/dist/util/Fetcher";
import NodeStorage from "solid-auth-fetcher/dist/localStorage/NodeStorage";
import IStorage from "solid-auth-fetcher/dist/localStorage/IStorage";
import ILoginOptions from "solid-auth-fetcher/dist/login/ILoginOptions";
import IClient from "solid-auth-fetcher/dist/login/oidc/IClient";

const method = "get";
const url = "https://localhost:8443/";
const issuer = "https://localhost:8443";

let joseUtility: IJoseUtility;
let storage: IStorage;
let storageUtility: IStorageUtility;
let fetcher: IFetcher;
let jwk: JSONWebKey;
let dpopHeaderCreator: IDpopHeaderCreator;
let issuerConfigFetcher: IIssuerConfigFetcher;
let loginOptions: ILoginOptions;

async function bootstrap(): Promise<void> {
  storage = new NodeStorage();
  storageUtility = new StorageUtility(storage);

  fetcher = new Fetcher();
  issuerConfigFetcher = new IssuerConfigFetcher(fetcher, storageUtility);
  joseUtility = new IsomorphicJoseUtility();
  jwk = await joseUtility.generateJWK("RSA", 2048, {
    alg: "RSA",
    use: "sig"
  });
  dpopHeaderCreator = new DpopHeaderCreator(
    new IsomorphicJoseUtility(),
    ({
      getClientKey: (): JSONWebKey => {
        return jwk;
      }
    } as unknown) as IDpopClientKeyManager,
    new UuidGenerator()
  );
  loginOptions = {
    localUserId: "alice"
  };
}

async function createFetchHeaders(params: {
  authToken: string;
  url: string;
  method: string;
}): Promise<{ authorization: string; dpop: string }> {
  const dpopHeader = await dpopHeaderCreator.createHeaderToken(
    new URL(params.url),
    params.method
  );
  return {
    authorization: `DPop ${params.authToken}`,
    dpop: dpopHeader
  };
}

async function requestToken(): Promise<string> {
  const requester = new TokenRequester(
    storageUtility,
    issuerConfigFetcher,
    fetcher,
    dpopHeaderCreator,
    new IsomorphicJoseUtility()
  );
  await requester.request("alice", {
    // eslint-disable-next-line @typescript-eslint/camelcase
    grant_type: "refresh_token",
    // eslint-disable-next-line @typescript-eslint/camelcase
    refresh_token: "thisIsARefreshToken"
  });
  return "";
}

async function registerClient(): Promise<void> {
  const clientRegistrar = new ClientRegistrar(fetcher);
  const issuerConfig = await issuerConfigFetcher.fetchConfig(new URL(issuer));
  const client: IClient = await clientRegistrar.getClient(
    loginOptions,
    issuerConfig
  );
  console.log(client);
  await storageUtility.setForUser("alice", "issuer", issuer);
  if (client.clientId) {
    await storageUtility.setForUser("alice", "clientId", client.clientId);
  }
  if (client.clientSecret) {
    await storageUtility.setForUser(
      "alice",
      "clientSecret",
      client.clientSecret
    );
  }
}

async function test(): Promise<void> {
  try {
    await bootstrap();
    await registerClient();
    const authToken = await requestToken();
    // const headers = await createFetchHeaders({
    //   authToken,
    //   url,
    //   method
    // });
    // console.log(headers);
    // // const result = await fetch(url, { headers });
  } catch (e) {
    console.error(e.message);
  }
}
test();
