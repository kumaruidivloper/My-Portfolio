export interface GratuityRecord {
  date: string;
  gratuity: number;
  difference: number;
}

export interface GratuityApiDocument {
  id: string;
  name: string;
  title: string;
  description: string;
  type: string;
  gratuityRecords: GratuityRecord[];
}
