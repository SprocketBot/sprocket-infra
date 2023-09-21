import * as pulumi from "@pulumi/pulumi";
const URN_PREFIX = "SprocketBot";

export enum URN_TYPE {
  Service = "Service",
  OneOff = "OneOff",
  Configuration = "Configuration",
  Utility = "Utility",
  LogicalGroup = "LogicalGroup",
  Database = "Database",
  /**
   * Used when templating components, forces the author to select the correct type.
   */
  Invalid = "%%",
}

export const buildUrn = (
  type: URN_TYPE,
  ComponentName: string,
  ResourceName?: string,
) =>
  `${URN_PREFIX}:${type}:${ComponentName}${
    ResourceName ? `:${ResourceName}` : ""
  }`;

export const config = new pulumi.Config();

export const BASE_HOSTNAME = config.require("base-hostname");
