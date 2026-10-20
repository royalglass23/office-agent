import { companyCheckIdentity } from "@/lib/company-check/auth";
import { getConfig } from "@/lib/config";
import CompanyCheck from "./company-check";

export const dynamic = "force-dynamic";

export default async function CompanyCheckPage() {
  if (!getConfig().companyCheck.enabled) return <main><h1>Company check unavailable</h1></main>;
  if (!await companyCheckIdentity()) {
    return <main style={{ maxWidth: 680, margin: "4rem auto", padding: 24 }}>
      <h1>Office Agent company check</h1>
      <p>Open Office Agent from the authorised ServiceM8 Add-ons menu to start a staff session.</p>
    </main>;
  }
  return <CompanyCheck />;
}
