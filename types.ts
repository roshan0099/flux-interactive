
export interface PointerData {
  x: number;
  y: number;
  dx: number;
  dy: number;
  moved: boolean;
}

export type FluidMode = 'flux' | 'ignite' | 'frost' | 'mist';
export type InstrumentType = 'flux' | 'drone' | 'spark' | 'orbit';

export interface SimulationConfig {
  dyeResolution: number;
  simResolution: number;
  densityDissipation: number;
  velocityDissipation: number;
  pressure: number;
  curl: number;
  radius: number;
}
