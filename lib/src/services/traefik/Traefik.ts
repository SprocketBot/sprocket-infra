import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import {
  BASE_HOSTNAME,
  buildUrn,
  config,
  URN_TYPE,
} from "../../constants/pulumi";
import { SocketProxy } from "./TraefikSocketProxy";
import {
  ConfigFile,
  LogDriver,
  ServiceCategory,
  TraefikHttpLabel,
} from "../../utils";
import { EntryPoint } from "../../constants/traefik";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";
import { Config } from "@pulumi/pulumi";

export interface TraefikArgs {
  staticConfigPath: string;
  forwardAuthConfigPath: string;
}

export class Traefik extends pulumi.ComponentResource {
  private readonly socketProxy: SocketProxy;
  private readonly staticConfig: docker.ServiceConfig;
  private readonly volume: docker.Volume;

  readonly network: docker.Network;
  readonly service: docker.Service;

  constructor(
    name: string,
    args: TraefikArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "Traefik"), name, {}, opts);
    this.socketProxy = new SocketProxy(`socket-proxy`, { parent: this });

    this.network = new docker.Network(
      `traefik-network`,
      {
        driver: "overlay",
        attachable: true,
      },
      { parent: this },
    );

    this.staticConfig = new ConfigFile(
      `traefik-static-config`,
      {
        filepath: args.staticConfigPath,
        vars: pulumi
          .all([
            this.socketProxy.serviceName,
            config.get("traefik-ca-server"),
            this.network.name,
          ])
          .apply(([$serviceName, $caServer, $netName]) => ({
            socketProxyHostname: $serviceName,
            caServer: $caServer,
            traefik_network_name: $netName,
          })),
      },
      { parent: this },
    );

    this.volume = new docker.Volume(`acme-data-vol`, {}, { parent: this });

    const customCa = config.get("traefik-trust-ca")
      ? new ConfigFile(
          "custom-ca",
          {
            filepath: config.require("traefik-trust-ca"),
            vars: {},
          },
          { parent: this },
        )
      : null;

    this.service = new docker.Service(
      name,
      {
        labels: new TraefikHttpLabel(`${name}-dashboard`)
          .rule(`Host(\`traefik.${BASE_HOSTNAME}\`)`)
          .service("api@internal")
          .entryPoints(EntryPoint.HTTPS)
          .tls("lets-encrypt-tls")
          .targetPort(9999)
          .forwardAuthRule("SprocketAdmin").complete,
        taskSpec: {
          containerSpec: {
            image:
              "traefik:v3.0@sha256:db21af65fb9edaa04542efe69bb6ba74afa04231874b0240fcccb059547fbf24",
            args: ["--configFile=/static.yaml"],
            mounts: [
              {
                type: "volume",
                source: this.volume.id,
                target: "/data",
              },
            ],
            configs: [
              {
                configId: this.staticConfig.id,
                configName: this.staticConfig.name,
                fileName: "/static.yaml",
              },
              customCa
                ? {
                    configId: customCa.id,
                    configName: customCa.name,
                    fileName: "/usr/local/share/ca-certificates/custom-ca.crt",
                  }
                : null,
            ].filter(
              Boolean,
            ) as docker.types.input.ServiceTaskSpecContainerSpecConfig[],
            env: {
              LEGO_CA_CERTIFICATES: customCa
                ? "/usr/local/share/ca-certificates/custom-ca.crt"
                : "",
            },
          },
          logDriver: LogDriver("traefik", ServiceCategory.INFRASTRUCTURE),
          placement: {
            constraints: [RoleRestriction(Role.INGRESS)],
            platforms: [{ architecture: "amd64", os: "linux" }],
          },
          networksAdvanceds: [
            {
              name: this.network.id,
            },
            {
              name: this.socketProxy.networkId,
            },
          ],
        },
        endpointSpec: {
          ports: [
            {
              targetPort: 80,
              publishedPort: 80,
              protocol: "tcp",
            },
            {
              targetPort: 443,
              publishedPort: 443,
              protocol: "tcp",
            },
          ],
        },
      },
      { parent: this, deleteBeforeReplace: true },
    );

    // TODO: add forward auth
  }
}
