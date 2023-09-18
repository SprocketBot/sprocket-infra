import { SprocketStackDefinition } from "./types";

export enum LayerOneExports {
  IngressNetwork = "IngressNetwork",
  VaultNetwork = "VaultNetwork",
  VaultAddress = "VaultAddress",
}

export default new SprocketStackDefinition(
  "layer_1",
  `${__dirname}/../../layer_1`,
);
