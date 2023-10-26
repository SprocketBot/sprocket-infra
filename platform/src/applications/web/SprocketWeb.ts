import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import {
  BASE_HOSTNAME,
  buildUrn,
  Outputable,
  URN_TYPE,
} from "@sprocketbot/infra-lib";
import { SprocketService, SprocketServiceArgs } from "../SprocketService";

export type SprocketWebArgs = Omit<
  SprocketServiceArgs,
  "image" | "networks" | "url" | "innerPort"
> & {
  networks: {
    ingress: docker.Network["id"];
    platform: docker.Network["id"];
    additional?: docker.Network["id"][];
  };
};

export class SprocketWeb extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: SprocketWebArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "SprocketWeb", name), name, {}, opts);

    const service = new SprocketService(
      name,
      {
        ...args,
        innerPort: 3000,
        image: {
          namespace: "actualsovietshark",
          repository: "web",
          tag: pulumi.getStack(),
        },
        url: BASE_HOSTNAME,
        env: {
          PUBLIC_GQL_URL: `https://api.${BASE_HOSTNAME}`, // TODO: This should probably come from the SprocketCore
        },
      },
      { parent: this },
    );
  }
}
