// Handles self
import { Gatus, N8n, Redis, VaultPolicies } from 'global/services';
import { Monitoring } from './monitoring';
import * as pulumi from '@pulumi/pulumi';
import * as vault from '@pulumi/vault';
import * as postgres from '@pulumi/postgresql';
import * as docker from '@pulumi/docker';
import { LayerOne, LayerOneExports } from 'global/refs';
import { HOSTNAME } from "../../global/constants";

import { SprocketPostgresProvider } from 'global/providers/SprocketPostgresProvider';

const config = new pulumi.Config();

const ingressNetworkId = LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>;
export const policies = new VaultPolicies('policies', {});

const vaultProvider = new vault.Provider('VaultProvider', {
  address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
  token: policies.infraToken.clientToken
});

// Using cloud S3-compatible storage instead of local Minio
// export const minio = new Minio('minio', { ingressNetworkId, vaultProvider });

const chatwootNetwork = new docker.Network('chatwoot-network', {
  driver: 'overlay'
});

export const pg = new SprocketPostgresProvider({
  vaultProvider: vaultProvider
}, {});

export const postgresProvider: postgres.Provider = pg as postgres.Provider;

// export const n8n = new N8n('n8n', {
//   ingressNetworkId: ingressNetworkId,
//   postgresHostname: HOSTNAME,
//   postgresNetworkId: ingressNetworkId,
//   providers: {
//     vault: vaultProvider,
//     postgres: postgresProvider
//   },
// });

export const monitoring = new Monitoring('monitoring', {
  exposeInfluxUi: true,
  ingressNetworkId,
  providers: {
    vault: vaultProvider,
    postgres: postgresProvider
  }
});

const sharedRedis = new Redis("layer2redis", {
  configFilepath: `${__dirname}/config/redis/redis.conf`,
  ingressNetworkId: ingressNetworkId,
  vaultProvider: vaultProvider,
  platformNetworkId: chatwootNetwork.id,
});

export const GatusInternal = new Gatus("gatus-internal", {
  ingressNetworkId,
  configFilePath: `${__dirname}/config/gatus/config.yml`,
});