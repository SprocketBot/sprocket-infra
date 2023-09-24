import * as pulumi from "@pulumi/pulumi";
import { WithOverrides } from "../types";

export enum PlatformStackOutputs {
  X = "X",
}

// This might look a little scary; but this is a type-safe way for us to extend StackReference
// While also changing the signature of a few functions.

class PlatformStack extends WithOverrides(pulumi.StackReference, [
  "getOutput",
  "getOutputValue",
]) {
  getOutput = <T = string>(
    name: pulumi.Input<PlatformStackOutputs>,
  ): pulumi.Output<T> =>
    pulumi.StackReference.prototype.getOutput.call(
      this,
      name as string,
    ) as pulumi.Output<T>;

  getOutputValue = <T = string>(
    name: pulumi.Input<PlatformStackOutputs>,
  ): Promise<T> =>
    pulumi.StackReference.prototype.getOutputValue.call(
      this,
      name as string,
    ) as Promise<T>;
}

export const PlatformStackRef = {
  main:
    pulumi.getStack() === "main"
      ? null
      : new PlatformStack("main-stack-ref", {
          name: "ItsMeBrianD/SprocketPlatform/main", // TOOD: Make this configurable
        }),
  staging:
    pulumi.getStack() === "staging"
      ? null
      : new PlatformStack("staging-stack-ref", {
          name: "ItsMeBrianD/SprocketPlatform/staging", // TOOD: Make this configurable
        }),
  dev:
    pulumi.getStack() === "dev"
      ? null
      : new PlatformStack("dev-stack-ref", {
          name: "ItsMeBrianD/SprocketPlatform/dev", // TOOD: Make this configurable
        }),
};
