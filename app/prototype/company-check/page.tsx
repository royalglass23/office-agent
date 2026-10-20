import { notFound } from "next/navigation";
import CompanyCheckPrototype from "./prototype";

// PROTOTYPE: compare three Office Agent company-check flows at /prototype/company-check?variant=A|B|C.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CompanyCheckPrototype />;
}
