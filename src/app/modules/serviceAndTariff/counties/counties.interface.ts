export interface ICounty {
  name: string;
  state: string;
  baseFare: number;
  internalNotes?: string;
  boundary: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  isActive?: boolean;
}

