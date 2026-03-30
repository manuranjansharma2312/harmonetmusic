import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

export default function AdminPromotionalSettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [settingsId, setSettingsId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('promotion_settings').select('id, is_enabled').limit(1).single();
    if (data) {
      setSettingsId(data.id);
      setIsEnabled(data.is_enabled);
    }
    setLoading(false);
  };

  const toggleEnabled = async (val: boolean) => {
    const { error } = await supabase
      .from('promotion_settings')
      .update({ is_enabled: val, updated_at: new Date().toISOString() })
      .eq('id', settingsId);
    if (error) {
      toast.error('Failed to update');
      return;
    }
    setIsEnabled(val);
    toast.success(val ? 'Promotional Tools enabled for users' : 'Promotional Tools disabled for users');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Promotional Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Visibility Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Promotional Tools for Users</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, users can view and purchase promotional services.
                </p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
