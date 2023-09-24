import * as e from "./src/index";
import { Equals, DataTeamStackOutputs } from "@sprocketbot/infra-lib";

// Test that exports are correct
type ExportsNeeded = Equals<typeof e, Record<DataTeamStackOutputs, any>>;
const StackExportsAllNeededVariables: ExportsNeeded = true;

export * from "./src/index";
