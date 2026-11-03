import type { TAX_CONDITIONS } from "@/lib/validations/wholesale-customer";

// Valores del formulario de cliente mayorista (todo como texto para los inputs).
// Vive fuera del componente cliente para poder armarlos también desde páginas de servidor.
export type WholesaleCustomerFormValues = {
  email: string;
  phone: string;
  contactName: string;
  businessName: string;
  legalName: string;
  businessType: string;
  cuit: string;
  taxCondition: (typeof TAX_CONDITIONS)[number] | "";
  street: string;
  floor: string;
  city: string;
  province: string;
  postalCode: string;
  reference: string;
  allowDeferredPayment: boolean;
  extraDiscountPercentage: string;
  active: boolean;
  adminNotes: string;
};

export const EMPTY_WHOLESALE_CUSTOMER: WholesaleCustomerFormValues = {
  email: "",
  phone: "",
  contactName: "",
  businessName: "",
  legalName: "",
  businessType: "",
  cuit: "",
  taxCondition: "",
  street: "",
  floor: "",
  city: "",
  province: "",
  postalCode: "",
  reference: "",
  allowDeferredPayment: false,
  extraDiscountPercentage: "0",
  active: true,
  adminNotes: "",
};
