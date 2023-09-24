import "./src/index";

import * as e from "./src/index";
import { Equals, PlatformStackOutputs } from "@sprocketbot/infra-lib";

// Test that exports are correct
type ExportsNeeded = Equals<typeof e, Record<PlatformStackOutputs, any>>;
const StackExportsAllNeededVariables: ExportsNeeded = true;

export * from "./src/index";
