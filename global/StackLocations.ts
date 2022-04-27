import {LayerOne, LayerTwo} from "./refs";
export const stackLocations = [LayerOne, LayerTwo].map(r => ({
    name: r.name,
    workDir: r.location
}))