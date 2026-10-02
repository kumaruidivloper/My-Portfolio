export interface TransferRecord {
  dateOfTransfer: string;
  amountTransferredAUD: number;
  conversionRate: number;
  receivedDate: string;
  amountReceivedINR: number;
}

export interface TransferApiDocument {
  transfers: TransferRecord[];
}
