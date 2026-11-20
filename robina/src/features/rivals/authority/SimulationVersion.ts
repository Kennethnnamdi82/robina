export const SIMULATION_VERSION = 3;
export const COLLISION_SIMULATION_VERSION = 4;
export const VISIBLE_VEHICLE_SIMULATION_VERSION = 5;
export function isReplaySimulationVersion(value:unknown):value is number{
  return value===SIMULATION_VERSION||value===COLLISION_SIMULATION_VERSION||value===VISIBLE_VEHICLE_SIMULATION_VERSION;
}
