import * as pulumi from "@pulumi/pulumi";
import { WithOverrides } from "../types";

export enum GrafanaStackOutputs {
  AdminCredsPath = "AdminCredsPath",
  GrafanaUrl = "GrafanaUrl",
}

// This might look a little scary; but this is a type-safe way for us to extend StackReference
// While also changing the signature of a few functions.

class GrafanaStack extends WithOverrides(pulumi.StackReference, [
  "getOutput",
  "getOutputValue",
]) {
  getOutput = <T = string>(
    name: pulumi.Input<GrafanaStackOutputs>,
  ): pulumi.Output<T> =>
    pulumi.StackReference.prototype.getOutput.call(
      this,
      name as string,
    ) as pulumi.Output<T>;

  getOutputValue = <T = string>(
    name: pulumi.Input<GrafanaStackOutputs>,
  ): Promise<T> =>
    pulumi.StackReference.prototype.getOutputValue.call(
      this,
      name as string,
    ) as Promise<T>;
}

export const GrafanaStackRef =
  pulumi.getStack() === "grafana"
    ? null
    : new GrafanaStack("grafana-stack-ref", {
        name: "ItsMeBrianD/SprocketGrafana/grafana", // TOOD: Make this configurable
      });
