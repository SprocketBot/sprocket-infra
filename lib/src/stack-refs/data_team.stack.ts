import * as pulumi from "@pulumi/pulumi";
import { WithOverrides } from "../types";

export enum DataTeamStackOutputs {
  NO = "NO",
}

// This might look a little scary; but this is a type-safe way for us to extend StackReference
// While also changing the signature of a few functions.

class DataTeamStack extends WithOverrides(pulumi.StackReference, [
  "getOutput",
  "getOutputValue",
]) {
  getOutput = <T = string>(
    name: pulumi.Input<DataTeamStackOutputs>,
  ): pulumi.Output<T> =>
    pulumi.StackReference.prototype.getOutput.call(
      this,
      name as string,
    ) as pulumi.Output<T>;

  getOutputValue = <T = string>(
    name: pulumi.Input<DataTeamStackOutputs>,
  ): Promise<T> =>
    pulumi.StackReference.prototype.getOutputValue.call(
      this,
      name as string,
    ) as Promise<T>;
}

export const DataTeamStackRef =
  pulumi.getStack() === "data-team"
    ? null
    : new DataTeamStack("data-team-stack-ref", {
        name: "ItsMeBrianD/SprocketDataTeam/data", // TOOD: Make this configurable
      });
