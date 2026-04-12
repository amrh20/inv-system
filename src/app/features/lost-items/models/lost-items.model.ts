export interface LostItemsListRow {
  id: string;
  itemName: string;
  itemBarcode: string | null;
  qtyLost: number;
  date: string;
  getPassRef: string | null;
  lossRecordedBy: { id: string; firstName: string; lastName: string } | null;
  getPassReturnId: string | null;
}
