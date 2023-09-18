import * as pulumi from "@pulumi/pulumi";

type BackendLike = { path: Outputable<string> } & pulumi.Resource;

const backends: Record<string, BackendLike> = {};

export enum Backend {
  kv2 = "kv2",
  db = "database",
}

const clean = (name: string): string => {
  // Remote leading slashes
  return name;
};

export const setBackend = (name: Backend, backend: BackendLike) => {
  if (name in backends)
    throw new Error(`"${name}" is already associated with a secrets backend`);
  backends[name] = backend;
};

export const getBackend = (name: Backend): BackendLike => {
  if (name in backends) return backends[name];
  throw new Error(`"${name}" does not have a backend associated with it.`);
};
