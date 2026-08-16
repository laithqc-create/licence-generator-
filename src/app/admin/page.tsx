// ─────────────────────────────────────────────────────────────────────────────
// Admin Panel — /admin
// Protected by ADMIN_SECRET env var entered in the UI
// Create products, set prices, copy checkout URLs
// ─────────────────────────────────────────────────────────────────────────────
import { AdminPanel } from "@/components/AdminPanel";

export const metadata = { title: "Admin — DecentraLicense" };

export default function AdminPage() {
  return <AdminPanel />;
}
