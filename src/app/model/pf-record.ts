export interface PfRecord {
  date: string;
  pfAmount: number;
  difference: number;
}

export interface PfApiDocument {
  id: string;
  name: string;
  description: string;
  pfRecords: PfRecord[];
}
