type sales = {
  id: number;
  customer: {
    id: number;
    name: string;
    phone: string;
    address: string;
    date: string;
    paymentMethod: string;
    totalPurchased: number;
    amountPaid: number;
    amountDue: number;
    totalDue: number;
    status: string;
    products: [];
  };
  purchasedProducts: Product[];
  sellingPrice: number;
  costPrice: number; //Products.variants.landing
  netGain: number; //profit or loss per sale
};
type expenses = {
  id: number;
  date: Date;
  nameOfExpense: string;
  typeOfExpense: string; //Import || General || Taxes
  amountOfExpense: number;
};
type netPosition = {
}
