export interface TotalRecord {
  date: string;
  total: number;
  difference: number;
}

export interface TotalApiDocument {
  id: string;
  name: string;
  type: string;
  totalRecords: TotalRecord[];
}
