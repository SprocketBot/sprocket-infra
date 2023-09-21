import { Outputable } from "../../types";
import { VaultConstants } from "../../constants";

type BackendLike = Outputable<{ path: Outputable<string> }>;

const backends: Record<string, BackendLike> = {};

export const setBackend = (
  name: VaultConstants.Backend,
  backend: BackendLike,
) => {
  if (name in backends)
    throw new Error(`"${name}" is already associated with a secrets backend`);
  backends[name] = backend;
};

export const getBackend = (
  name: VaultConstants.Backend,
): BackendLike | undefined => {
  if (name in backends) return backends[name];
  return undefined;
};
