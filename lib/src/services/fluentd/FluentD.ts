import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";
import { ConfigFile } from "../../utils";

export type FluentDArgs = {
  config: ConfigFile;
  network: docker.Network["id"];
};

export class FluentD extends pulumi.ComponentResource {
  private readonly service: docker.Service;

  constructor(
    name: string,
    args: FluentDArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Utility, "FluentD"), name, {}, opts);

    const entrypoint = new ConfigFile(
      "entrypoint-script",
      {
        filepath: "./scripts/fluentd/docker-entrypoint.sh",
      },
      { parent: this },
    );

    this.service = new docker.Service(
      "fluentd-service",
      {
        taskSpec: {
          containerSpec: {
            commands: ["sh", "/entrypoint.sh"],
            user: "root",
            image:
              "fluentd:latest@sha256:3b5e8bb493f277c0e04a5ff6f48a4a72fd13083a6ff09ac98527bec1c2f9d73d",
            configs: [
              {
                configName: args.config.name,
                configId: args.config.id,
                fileName: "/fluentd.yaml",
              },
              {
                configName: entrypoint.name,
                configId: entrypoint.id,
                fileName: "/entrypoint.sh",
              },
            ],
            env: {
              HOSTNAME: "{{.Node.Hostname}}",
            },
          },
          networksAdvanceds: [{ name: args.network }],
          resources: {
            limits: {
              // ~256mb
              memoryBytes: 256 * 1024 * 1024,
              // ~1/4 of a core
              nanoCpus: 0.25 * 1e9,
            },
          },
        },
        mode: { global: true },
        updateConfig: { parallelism: 0 },
        endpointSpec: {
          ports: [
            {
              publishedPort: 24224,
              targetPort: 24224,
              publishMode: "host",
              protocol: "tcp",
            },
          ],
        },
      },
      { parent: this },
    );
  }
}
