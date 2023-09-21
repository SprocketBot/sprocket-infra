import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";
import { BASE_HOSTNAME, buildUrn, URN_TYPE } from "../../constants/pulumi";
import {
  LogDriver,
  ServiceCategory,
  TraefikHttpLabel,
  UserPassCredential,
  VaultUtils,
} from "../../utils";
import { EntryPoint } from "../../constants/traefik";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";
import { Outputable } from "../../types";

export type InfluxDbArgs = {
  ingressNetworkId: docker.Network["id"];
  monitoringNetworkId: docker.Network["id"];
  exposeUi: boolean;
};

export class InfluxDb extends pulumi.ComponentResource {
  private readonly service: docker.Service;
  private readonly volume: docker.Volume;

  readonly adminToken: random.RandomPassword["result"];
  readonly url: Outputable<string>;
  readonly internalHostname: docker.Service["name"];

  constructor(
    name: string,
    args: InfluxDbArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "InfluxDb", name), name, {}, opts);

    const credentials = new UserPassCredential(
      "creds",
      { path: { name: "maintainer/generated/influxdb/admin" } },
      { parent: this },
    );
    const initialToken = new random.RandomPassword(
      "token",
      {
        length: 32,
      },
      { parent: this },
    );
    this.adminToken = initialToken.result;

    this.url = `https://influx.${BASE_HOSTNAME}`;
    const traefikLabels = new TraefikHttpLabel(name)
      .rule(`Host(\`influx.${BASE_HOSTNAME}\`)`)
      .tls("lets-encrypt-tls")
      .targetPort(8086)
      .entryPoints(EntryPoint.HTTPS).complete;

    this.volume = new docker.Volume(`influx-data`, {}, { parent: this });

    this.service = new docker.Service(
      "influx-service",
      {
        // Pin the name to prevent desync when used in applications
        // i.e. if this is updated and the applications are not, they will point to the wrong url
        name: new random.RandomPet(
          "service-name",
          {},
          { parent: this },
        ).id.apply(($id) => `influx-${$id}`),
        taskSpec: {
          containerSpec: {
            image:
              "influxdb:2.7@sha256:17390018173e18a8b7d0c3c6495a6cc066a82295084d7a427dd32ea2c5928d4a",
            env: {
              DOCKER_INFLUXDB_INIT_MODE: "setup",
              DOCKER_INFLUXDB_INIT_USERNAME: credentials.username,
              DOCKER_INFLUXDB_INIT_PASSWORD: credentials.password,
              DOCKER_INFLUXDB_INIT_RETENTION: "30d",
              DOCKER_INFLUXDB_INIT_ORG: "sprocket",
              DOCKER_INFLUXDB_INIT_BUCKET: "metrics",
              DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: initialToken.result,
            },
            mounts: [
              {
                type: "volume",
                source: this.volume.id,
                target: "/var/lib/influxdb2",
              },
            ],
          },
          logDriver: LogDriver("influxdb", ServiceCategory.MONITORING),
          networksAdvanceds: [
            { name: args.ingressNetworkId },
            { name: args.monitoringNetworkId },
          ],
          placement: {
            constraints: [RoleRestriction(Role.SECONDARY_STORAGE)],
            platforms: [{ architecture: "amd64", os: "linux" }],
          },
        },
        labels: args.exposeUi ? traefikLabels : [],
      },
      { parent: this },
    );

    this.internalHostname = this.service.name;
  }
}
