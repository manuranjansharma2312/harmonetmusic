import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Item {
  id: string;
  name: string;
}

function ManageList({ title, table }: { title: string; table: 'genres' | 'languages' }) {
  const [items, setItems] = useState<Item[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase.from(table).select('id, name').order('name');
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from(table).insert({ name: newName.trim() });
    if (error) {
      toast.error(error.message.includes('unique') ? `${newName} already exists` : error.message);
    } else {
      toast.success(`${newName} added`);
      setNewName('');
      fetchItems();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${name} deleted`);
      fetchItems();
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  return (
    <GlassCard className="w-full">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      <div className="flex gap-2 mb-4">
        <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Add new ${title.toLowerCase().slice(0, -1)}`} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <Button onClick={handleAdd} disabled={adding} size="icon" className="shrink-0">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
              <span className="text-sm text-foreground">{item.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id, item.name)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items yet.</p>}
        </div>
      )}
    </GlassCard>
  );
}

export default function AdminGenresLanguages() {
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 text-left sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Manage Genres & Languages</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Add or remove genres and languages available to users.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ManageList title="Genres" table="genres" />
          <ManageList title="Languages" table="languages" />
        </div>
      </div>
    </DashboardLayout>
  );
}
