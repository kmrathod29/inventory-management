// For to map out database scheme only
type Variant = {
    bucket_size: number;
    sales: number;
    mp: number;
    landing: number;
}

type Base = {
    name: string;
    stocks: number[]; // index matches variants array
}

type Product = {
    id: string;
    name: string;
    images: string;
    variants: Variant[];
    bases: Base[];
}

type Products = Product[];