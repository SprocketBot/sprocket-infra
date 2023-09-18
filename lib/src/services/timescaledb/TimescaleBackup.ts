import * as pulumi from "@pulumi/pulumi";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";

export type TimescaleBackupArgs = {};

export class TimescaleBackup extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: TimescaleBackupArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Invalid, "TimescaleBackup"), name, {}, opts);
  }
}
