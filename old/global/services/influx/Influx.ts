import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";

import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver";
import { VaultCredentials } from "../../helpers/vault/VaultCredentials";
import { TraefikLabels } from "../../helpers/docker/TraefikLabels";
import { HOSTNAME } from "../../constants";

export interface InfluxArgs {
  monitoringNetworkId: docker.Network["id"];
  ingressNetworkId: docker.Network["id"];
  exposeUi: boolean;
  vaultProvider: vault.Provider;
}

// TODO: Consider creating a CustomResource to sit next to this, that would be responsible for creating / destroying influxdb buckets.
export class Influx extends pulumi.ComponentResource {
  private readonly service: docker.Service;
  private readonly volume: docker.Volume;
  private readonly network: docker.Network;

  readonly networkId: docker.Network["id"];
  readonly credentials: VaultCredentials;

  constructor(
    name: string,
    args: InfluxArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("SprocketBot:Services:Influx", name, {}, opts);
    this.credentials = new VaultCredentials(
      `${name}-credentials`,
      {
        username: "admin",
        vault: { path: "infrastructure/influx", provider: args.vaultProvider },
      },
      { parent: this },
    );

    this.volume = new docker.Volume(`${name}-volume`, {}, { parent: this });

    this.network = new docker.Network(
      `${name}-network`,
      { driver: "overlay" },
      { parent: this },
    );
    this.networkId = this.network.id;

    const traefikLabels = new TraefikLabels(name, "http")
      .rule(`Host(\`influx.${HOSTNAME}\`)`)
      .tls(CertResolver.DNS)
      .targetPort(8086)
      .entryPoints("websecure").complete;

    this.service = new docker.Service(
      `${name}-service`,
      {
        // Pin the name to prevent desync when used in applications
        // i.e. if this is updated and the applications are not, they will point to the wrong url
        name: name,
        taskSpec: {
          containerSpec: {
            image: "influxdb:2.1-alpine",
            env: {
              DOCKER_INFLUXDB_INIT_MODE: "setup",
              DOCKER_INFLUXDB_INIT_USERNAME: this.credentials.username,
              DOCKER_INFLUXDB_INIT_PASSWORD: this.credentials.password,
              DOCKER_INFLUXDB_INIT_RETENTION: "30d",
              DOCKER_INFLUXDB_INIT_ORG: "sprocket",
              DOCKER_INFLUXDB_INIT_BUCKET: "metrics",
              DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: this.credentials.password,
            },
            mounts: [
              {
                type: "volume",
                source: this.volume.id,
                target: "/var/lib/influxdb2",
              },
            ],
          },
          logDriver: DefaultLogDriver(`${name}`, true),
          networks: [
            args.monitoringNetworkId,
            args.ingressNetworkId,
            this.network.id,
          ],
          placement: {
            constraints: ["node.labels.role==storage"],
          },
        },
        labels: args.exposeUi ? traefikLabels : [],
      },
      { parent: this },
    );

    this.registerOutputs({
      networkId: this.networkId,
    });
  }
}
