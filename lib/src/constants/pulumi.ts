import * as pulumi from "@pulumi/pulumi";
const URN_PREFIX = "SprocketBot"

export enum URN_TYPE  {
    Service = "Service",
    OneOff = "OneOff",
    Configuration = "Configuration"
}

export const buildUrn = (type: URN_TYPE, name: string) => `${URN_PREFIX}:${type}:${name}`;


export const config = new pulumi.Config()

export const BASE_HOSTNAME = config.require("base-hostname")