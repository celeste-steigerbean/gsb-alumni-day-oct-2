import { adminPasswordConfigured, isAdmin } from "@/lib/admin-auth";
import { getAdminEntries } from "@/lib/entries";
import { AdminGate } from "./admin-gate";
import { AdminScreen } from "./admin-screen";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const configured = adminPasswordConfigured();
  if (!configured || !(await isAdmin())) {
    return <AdminGate configured={configured} />;
  }

  const entries = await getAdminEntries();
  return <AdminScreen initial={entries} />;
}
