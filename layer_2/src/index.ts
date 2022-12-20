// Handles self
import { Airbyte, Chatwoot, Gatus, Minio, N8n, Postgres, Redis, VaultPolicies } from 'global/services';
import { Monitoring } from './monitoring';
import * as pulumi from '@pulumi/pulumi';
import * as vault from '@pulumi/vault';
import * as postgres from '@pulumi/postgresql';
import * as docker from '@pulumi/docker';
import { LayerOne, LayerOneExports } from 'global/refs';

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

export const pg = new Postgres('postgres', { ingressNetworkId, vaultProvider });

export const minio = new Minio('minio', { ingressNetworkId, vaultProvider });

const chatwootNetwork = new docker.Network('chatwoot-network', {
  driver: 'overlay'
});

const postgresProvider = new SprocketPostgresProvider({
  vaultProvider: vaultProvider,
  postgresCredentials: pg.credentials,
  postgresHostname: pg.url
}, {}) as postgres.Provider;


export const n8n = new N8n('n8n', {
  ingressNetworkId: ingressNetworkId,
  postgresHostname: pg.hostname,
  postgresNetworkId: pg.networkId,
  providers: {
    postgres: postgresProvider,
    vault: vaultProvider
  },
})


export const monitoring = new Monitoring('monitoring', {
  postgres: pg,
  exposeInfluxUi: true,
  ingressNetworkId,

  providers: {
    vault: vaultProvider,
    postgres: postgresProvider
  }
}, { dependsOn: [pg] });

const sharedRedis = new Redis("layer2redis", {
  configFilepath: `${__dirname}/config/redis/redis.conf`,
  ingressNetworkId: ingressNetworkId,
  vaultProvider: vaultProvider,
  platformNetworkId: chatwootNetwork.id,
  // monitoring: {
  //   influxToken: monitoring.influx.credentials.password,
  //   monitoringNetworkId: monitoring.network.id
  // }
})

export const chatwoot = new Chatwoot('chatwoot', {
  ingressNetworkId: ingressNetworkId,
  networkId: chatwootNetwork.id,
  postgresNetworkId: pg.networkId,
  smtp: {
    domain: 'sprocket.gg',
    host: 'smtp.sendgrid.net',
    password: vault.generic.getSecretOutput({ path: 'infrastructure/smtp' }, { provider: vaultProvider }).apply(s => s.data['password']) as pulumi.Output<string>,
    port: 587,
    username: 'apikey'
  },
  providers: {
    vault: vaultProvider,
    postgres: postgresProvider,
    minio: new SprocketMinioProvider({ minioHostname: minio.url, vaultProvider: vaultProvider })
  },
  postgres: {
    host: pg.hostname
  },
  redis: {
    host: sharedRedis.hostname,
    password: sharedRedis.credentials.password
  }
});

export const GatusInternal = new Gatus("gatus-internal", {
  ingressNetworkId,
  configFilePath: `${__dirname}/config/gatus/config.yml`,
})