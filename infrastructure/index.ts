import * as e from "./src/index";
import { Equals } from "@sprocketbot/infra-lib";
import { InfrastructureStackOutputs } from "@sprocketbot/infra-lib/bin/src/stack-refs/infra.stack";

// Test that exports are correct
type ExportsNeeded = Equals<typeof e, Record<InfrastructureStackOutputs, any>>;
const StackExportsAllNeededVariables: ExportsNeeded = true;

export * from "./src/index";
