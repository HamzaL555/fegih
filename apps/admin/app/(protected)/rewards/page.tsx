"use client";

import { PageHeader } from "@/components/admin/page-header";
import { RewardConfigEditor } from "@/components/admin/reward-config-editor";

export default function RewardsPage() {
  return <div>
    <PageHeader title="Mükafat konfiqurasiyaları" description="Sual səviyyələri, lives, ilk giriş, günlük mükafatlar və xal endirimləri" />
    <div className="grid gap-6 2xl:grid-cols-2">
      <RewardConfigEditor resource="question-levels" title="Sual səviyyələri" description="Hər səviyyə üçün mükafat parametrlərini serverdən gələn JSON formatında redaktə edin." />
      <RewardConfigEditor resource="lifelines" title="Lives" description="Livesin sayı, qiyməti və digər lives konfiqurasiyaları." />
      <RewardConfigEditor resource="first-login" title="İlk giriş mükafatı" description="İlk dəfə giriş edən istifadəçiyə verilən mükafat." />
      <RewardConfigEditor resource="daily-rewards" title="Günlük mükafatlar" description="Günlük streak və mükafat parametrləri." />
      <RewardConfigEditor resource="point-discounts" title="Xal endirimləri" description="Xal balansına tətbiq edilən endirim konfiqurasiyaları." />
    </div>
  </div>;
}
