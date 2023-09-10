import {BuildVault} from "./BuildVault";
import {Traefik} from "@sprocketbot/infra-lib";

const traefik = new Traefik("traefik", {
    staticConfigPath: "./src/config/traefik.yaml",
    forwardAuthConfigPath: "./src/config/traefik-forward-auth.yaml"
})

const vaultResult = BuildVault({traefik, configFilepath: `./src/config/vault.hcl`})