import * as e from "./src/index";
import { Equals, GrafanaStackOutputs } from "@sprocketbot/infra-lib";

// Test that exports are correct
type ExportsNeeded = Equals<typeof e, Record<GrafanaStackOutputs, any>>;
const StackExportsAllNeededVariables: ExportsNeeded = true;

export * from "./src/index";
