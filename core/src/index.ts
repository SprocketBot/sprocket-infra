import {Traefik} from "./traefik";
import {Vault} from "./vault";

export const ingress = new Traefik("traefik", { staticConfigurationPath: `${__dirname}/traefik/config/static.yaml` });
export const vault = new Vault("vault", {
    traefikNetworkId: ingress.networkId
})