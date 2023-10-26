import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { SocketProxy } from "./TraefikSocketProxy";
import {
  ConfigFile,
  LogDriver,
  ServiceCategory,
  TraefikHttpLabel,
} from "../../utils";
import {
  CertResolver,
  EntryPoint,
  ForwardAuthRule,
  BASE_HOSTNAME,
  buildUrn,
  config,
  URN_TYPE,
} from "../../constants";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";
import { Outputable } from "../../types";

export interface TraefikArgs {
  staticConfigPath: string;
  ingressNetwork?: docker.Network;
  forwardAuthConfigPath?: string;
  dnsToken?: Outputable<string>;
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

    if (args.ingressNetwork) this.network = args.ingressNetwork;
    else
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
            rolypoly: Boolean(args.ingressNetwork),
            dnsToken: Boolean(args.dnsToken),
          })),
      },
      { parent: this },
    );
    const faConfig = args.forwardAuthConfigPath
      ? new ConfigFile(
          `traefik-forward-auth-config`,
          {
            filepath: args.forwardAuthConfigPath,
          },
          { parent: this },
        )
      : null;

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

    const env: Record<string, Outputable<string>> = {};

    if (customCa) {
      env.LEGO_CA_CERTIFICATES =
        "/usr/local/share/ca-certificates/custom-ca.crt";
    }

    if (args.dnsToken) {
      env.DO_AUTH_TOKEN = args.dnsToken;
    }

    this.service = new docker.Service(
      name,
      {
        labels: new TraefikHttpLabel(`${name}-dashboard`)
          .rule(`Host(\`traefik.${BASE_HOSTNAME}\`)`)
          .service("api@internal")
          .entryPoints(EntryPoint.HTTPS)
          .tls(CertResolver.DNS, BASE_HOSTNAME)
          .targetPort(9999)
          .forwardAuthRule(ForwardAuthRule.ADMINS).complete,
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
              faConfig
                ? {
                    configId: faConfig.id,
                    configName: faConfig.name,
                    fileName: "/fa-dyn.yaml",
                  }
                : null,
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
            env: env,
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
              publishMode: "host",
            },
            {
              targetPort: 443,
              publishedPort: 443,
              publishMode: "host",
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
