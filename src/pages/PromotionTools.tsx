import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ShoppingCart, Package, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { PlatformIcon } from '@/components/PlatformIcons';

interface Tax {
  name: string;
  percent: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price_per_unit: number;
  platform: string;
}

interface Order {
  id: string;
  product_id: string;
  quantity: number;
  total_amount: number;
  screenshot_url: string | null;
  status: string;
  rejection_reason: string | null;
  starts_from: string | null;
  created_at: string;
  product_name?: string;
  product_platform?: string;
}

export default function PromotionTools() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Order form
  const [orderModal, setOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View order
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchProducts(), fetchOrders()]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('promotion_settings').select('*').limit(1).single();
    if (data) {
      setIsEnabled(data.is_enabled);
      setQrCodeUrl(data.qr_code_url);
      const taxData = data.taxes as any;
      if (Array.isArray(taxData)) setTaxes(taxData);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('promotion_products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data as any);
  };

  const fetchOrders = async () => {
    const { data: ordersData } = await supabase.from('promotion_orders').select('*').order('created_at', { ascending: false });
    if (!ordersData) return;
    const productIds = [...new Set(ordersData.map(o => o.product_id))];
    if (productIds.length === 0) { setOrders([]); return; }
    const { data: productsData } = await supabase.from('promotion_products').select('id, name, platform').in('id', productIds);
    const productMap = new Map((productsData || []).map((p: any) => [p.id, { name: p.name, platform: p.platform }]));
    setOrders(ordersData.map(o => {
      const prod = productMap.get(o.product_id);
      return { ...o, product_name: prod?.name || 'Unknown', product_platform: prod?.platform || '' };
    }));
  };

  const selectedProductObj = products.find(p => p.id === selectedProduct);
  const qty = Number(quantity) || 0;
  const baseAmount = selectedProductObj && qty > 0 ? (selectedProductObj.price_per_unit * qty / 1000) : 0;
  const taxBreakdown = taxes.map(t => ({ name: t.name, percent: t.percent, amount: baseAmount * (t.percent / 100) }));
  const totalTax = taxBreakdown.reduce((s, t) => s + t.amount, 0);
  const totalCost = (baseAmount + totalTax).toFixed(2);

  const submitOrder = async () => {
    if (!selectedProduct || !quantity || !screenshot || !user) {
      toast.error('Please fill all fields and upload screenshot');
      return;
    }
    setSubmitting(true);

    const ext = screenshot.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('promotion-screenshots').upload(path, screenshot);
    if (uploadErr) { toast.error('Screenshot upload failed'); setSubmitting(false); return; }

    const { data: urlData } = supabase.storage.from('promotion-screenshots').getPublicUrl(path);

    const { error } = await supabase.from('promotion_orders').insert({
      user_id: user.id,
      product_id: selectedProduct,
      quantity: qty,
      total_amount: Number(totalCost),
      screenshot_url: urlData.publicUrl,
    });

    if (error) { toast.error('Failed to submit order'); setSubmitting(false); return; }
    toast.success('Order submitted successfully!');
    setSubmitting(false);
    setOrderModal(false);
    setSelectedProduct('');
    setQuantity('');
    setScreenshot(null);
    fetchOrders();
  };

  const paginatedOrders = orders.slice((page - 1) * pageSize, page * pageSize);

  if (!isEnabled && !loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Promotion Tools</h2>
          <p className="text-muted-foreground">This feature is currently unavailable. Please check back later.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Promotion Tools</h1>
          <Button onClick={() => setOrderModal(true)}><ShoppingCart className="h-4 w-4 mr-2" /> Services</Button>
        </div>

        {/* Order History */}
        <Card>
          <CardHeader><CardTitle>My Orders</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts From</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders yet</TableCell></TableRow>
                ) : paginatedOrders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={o.product_platform || ''} size={18} />
                        <span className="font-medium">{o.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{o.quantity}</TableCell>
                    <TableCell>₹{o.total_amount}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{o.starts_from || '-'}</TableCell>
                    <TableCell className="text-sm">{format(new Date(o.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setViewOrder(o)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {orders.length > pageSize && (
              <TablePagination currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={() => {}} totalItems={orders.length} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Services Modal */}
      <Dialog open={orderModal} onOpenChange={setOrderModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Services</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Service *</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="Choose a service..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon platform={p.platform} size={18} />
                        {p.name} (₹{p.price_per_unit}/1000)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity..." />
            </div>

            {selectedProduct && qty > 0 && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Amount</span>
                  <span>₹{baseAmount.toFixed(2)}</span>
                </div>
                {taxBreakdown.map((t, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.name} ({t.percent}%)</span>
                    <span>₹{t.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg border-t border-primary/20 pt-2">
                  <span>Total</span>
                  <span className="text-primary">₹{totalCost}</span>
                </div>
              </div>
            )}

            {qrCodeUrl && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Scan QR to Pay</Label>
                <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-dashed border-primary/30">
                  <img
                    src={qrCodeUrl}
                    alt="Payment QR Code"
                    className="w-full max-w-[280px] h-auto aspect-square object-contain"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">Scan this QR code with any UPI app to make payment</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Upload Payment Screenshot *</Label>
              <Input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderModal(false)}>Cancel</Button>
            <Button onClick={submitOrder} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Order'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Modal */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {viewOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Service:</span>
                  <PlatformIcon platform={viewOrder.product_platform || ''} size={16} />
                  <span className="font-medium">{viewOrder.product_name}</span>
                </div>
                <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium">{viewOrder.quantity}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">₹{viewOrder.total_amount}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewOrder.status} /></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{format(new Date(viewOrder.created_at), 'dd MMM yyyy')}</span></div>
                {viewOrder.starts_from && <div><span className="text-muted-foreground">Starts From:</span> <span className="font-medium">{viewOrder.starts_from}</span></div>}
              </div>
              {viewOrder.rejection_reason && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                  <p className="text-sm">{viewOrder.rejection_reason}</p>
                </div>
              )}
              {viewOrder.screenshot_url && (
                <div className="space-y-2">
                  <Label>Payment Screenshot</Label>
                  <img src={viewOrder.screenshot_url} alt="Payment" className="max-w-full max-h-60 rounded-lg border object-contain" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
