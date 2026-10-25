import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return <div>
    <PageHeader title="Tənzimləmələr" description="Server tənzimləmələrini redaktə edin və /admin/settings endpoint-i vasitəsilə saxlayın" />
    <Card className="max-w-5xl"><CardHeader><CardTitle>Qlobal tənzimləmələr</CardTitle><CardDescription>Mətn, rəqəm, boolean, JSON və null dəyərləri dəstəklənir.</CardDescription></CardHeader><CardContent><SettingsForm /></CardContent></Card>
  </div>;
}
