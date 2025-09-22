// Handles self
import { Airbyte, Chatwoot, Gatus, Minio, N8n, Redis, VaultPolicies } from 'global/services';
import { Monitoring } from './monitoring';
import * as pulumi from '@pulumi/pulumi';
import * as vault from '@pulumi/vault';
import * as postgres from '@pulumi/postgresql';
import * as docker from '@pulumi/docker';
import { LayerOne, LayerOneExports } from 'global/refs';
import { HOSTNAME } from "../../global/constants";

import { SprocketPostgresProvider } from 'global/providers/SprocketPostgresProvider';
import { SprocketMinioProvider } from 'global/providers/SprocketMinioProvider';

const config = new pulumi.Config();

const ingressNetworkId = LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>;
export const policies = new VaultPolicies('policies', {});

const vaultProvider = new vault.Provider('VaultProvider', {
  address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
  token: policies.infraToken.clientToken
});

export const airbyte = new Airbyte('airbyte', {
  ingressNetworkId: ingressNetworkId,
});

export const minio = new Minio('minio', { ingressNetworkId, vaultProvider });

const chatwootNetwork = new docker.Network('chatwoot-network', {
  driver: 'overlay'
});

export const pg = new SprocketPostgresProvider({
  vaultProvider: vaultProvider
}, {});

export const postgresProvider: postgres.Provider = pg as postgres.Provider;

export const n8n = new N8n('n8n', {
  ingressNetworkId: ingressNetworkId,
  postgresHostname: HOSTNAME,
  postgresNetworkId: ingressNetworkId,
  providers: {
    vault: vaultProvider,
    postgres: postgresProvider
  },
});

export const monitoring = new Monitoring('monitoring', {
  exposeInfluxUi: true,
  ingressNetworkId,
  postgres: postgresProvider,
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

export const chatwoot = new Chatwoot('chatwoot', {
  ingressNetworkId: ingressNetworkId,
  networkId: chatwootNetwork.id,
  postgresNetworkId: ingressNetworkId,
  smtp: {
    domain: 'sprocket.gg',
    host: 'smtp.sendgrid.net',
    password: vault.generic.getSecretOutput({ path: 'infrastructure/data/smtp' }, { provider: vaultProvider }).apply(s => "nothingburger") as pulumi.Output<string>,
    port: 587,
    username: 'apikey'
  },
  providers: {
    vault: vaultProvider,
    minio: new SprocketMinioProvider({ minioHostname: minio.url, vaultProvider: vaultProvider }),
    postgres: postgresProvider
  },
  postgres: {
    host: HOSTNAME
  },
  redis: {
    host: sharedRedis.hostname,
    password: sharedRedis.credentials.password
  }
});

export const GatusInternal = new Gatus("gatus-internal", {
  ingressNetworkId,
  configFilePath: `${__dirname}/config/gatus/config.yml`,
});