import { Traefik, Vault } from "global/services";

export const ingress = new Traefik("traefik", {
  staticConfigurationPath: `${__dirname}/config/traefik/static.yaml`,
  faConfigurationPath: `${__dirname}/config/traefik/discord-forward-auth.yaml`,
});
export const vault = new Vault("vault", {
  traefikNetworkId: ingress.networkId,
  configurationPath: `${__dirname}/config/vault/vault.hcl`,
});
