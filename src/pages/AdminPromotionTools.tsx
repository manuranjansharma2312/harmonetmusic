import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, QrCode, Package, Percent, X } from 'lucide-react';
import { format } from 'date-fns';
import { PlatformIcon, PLATFORMS } from '@/components/PlatformIcons';

interface Tax {
  name: string;
  percent: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price_per_unit: number;
  is_active: boolean;
  platform: string;
  created_at: string;
}

interface Order {
  id: string;
  user_id: string;
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
  user_display_id?: number;
  user_name?: string;
}

export default function AdminPromotionTools() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [takedownPaymentEnabled, setTakedownPaymentEnabled] = useState(false);
  const [settingsId, setSettingsId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Product modal
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productPlatform, setProductPlatform] = useState('');
  const [productActive, setProductActive] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);

  // Order modal
  const [orderModal, setOrderModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [orderStartsFrom, setOrderStartsFrom] = useState('');
  const [orderRejectionReason, setOrderRejectionReason] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'order'; id: string } | null>(null);

  // Pagination
  const [productPage, setProductPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const pageSize = 10;

  // QR upload
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchProducts(), fetchOrders()]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('promotion_settings').select('*').limit(1).single();
    if (data) {
      setSettingsId(data.id);
      setIsEnabled(data.is_enabled);
      setQrCodeUrl(data.qr_code_url);
      const taxData = data.taxes as any;
      if (Array.isArray(taxData)) setTaxes(taxData);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('promotion_products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data as any);
  };

  const fetchOrders = async () => {
    const { data: ordersData } = await supabase.from('promotion_orders').select('*').order('created_at', { ascending: false });
    if (!ordersData) return;

    const productIds = [...new Set(ordersData.map(o => o.product_id))];
    const { data: productsData } = await supabase.from('promotion_products').select('id, name, platform').in('id', productIds);
    const productMap = new Map((productsData || []).map((p: any) => [p.id, { name: p.name, platform: p.platform }]));

    const userIds = [...new Set(ordersData.map(o => o.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_id, artist_name, record_label_name, user_type').in('user_id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    setOrders(ordersData.map(o => {
      const profile = profileMap.get(o.user_id);
      const prod = productMap.get(o.product_id);
      return {
        ...o,
        product_name: prod?.name || 'Unknown',
        product_platform: prod?.platform || '',
        user_display_id: profile?.display_id,
        user_name: profile?.user_type === 'record_label' ? profile?.record_label_name : profile?.artist_name || 'Unknown',
      };
    }));
  };

  const toggleEnabled = async (val: boolean) => {
    const { error } = await supabase.from('promotion_settings').update({ is_enabled: val, updated_at: new Date().toISOString() }).eq('id', settingsId);
    if (error) { toast.error('Failed to update'); return; }
    setIsEnabled(val);
    toast.success(val ? 'Promotion Tools enabled' : 'Promotion Tools disabled');
  };

  // Tax management
  const addTax = () => setTaxes([...taxes, { name: '', percent: 0 }]);
  const removeTax = (i: number) => setTaxes(taxes.filter((_, idx) => idx !== i));
  const updateTax = (i: number, field: 'name' | 'percent', value: string) => {
    const updated = [...taxes];
    if (field === 'name') updated[i].name = value;
    else updated[i].percent = Number(value) || 0;
    setTaxes(updated);
  };
  const saveTaxes = async () => {
    for (const t of taxes) {
      if (!t.name.trim()) { toast.error('All taxes must have a name'); return; }
    }
    const { error } = await supabase.from('promotion_settings').update({ taxes: taxes as any, updated_at: new Date().toISOString() }).eq('id', settingsId);
    if (error) { toast.error('Failed to save taxes'); return; }
    toast.success('Taxes saved');
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    const ext = file.name.split('.').pop();
    const path = `qr-code.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('promotion-qr').upload(path, file, { upsert: true });
    if (uploadErr) { toast.error('Upload failed'); setUploadingQr(false); return; }
    const { data: urlData } = supabase.storage.from('promotion-qr').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('promotion_settings').update({ qr_code_url: url, updated_at: new Date().toISOString() }).eq('id', settingsId);
    setQrCodeUrl(url);
    setUploadingQr(false);
    toast.success('QR code updated');
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductName(product.name);
      setProductDesc(product.description);
      setProductPrice(String(product.price_per_unit));
      setProductPlatform(product.platform || '');
      setProductActive(product.is_active);
    } else {
      setEditingProduct(null);
      setProductName('');
      setProductDesc('');
      setProductPrice('');
      setProductPlatform('');
      setProductActive(true);
    }
    setProductModal(true);
  };

  const saveProduct = async () => {
    if (!productName.trim() || !productPrice) { toast.error('Name and price required'); return; }
    setSavingProduct(true);
    const payload: any = { name: productName.trim(), description: productDesc.trim(), price_per_unit: Number(productPrice), platform: productPlatform, is_active: productActive, updated_at: new Date().toISOString() };
    if (editingProduct) {
      const { error } = await supabase.from('promotion_products').update(payload).eq('id', editingProduct.id);
      if (error) { toast.error('Failed to update'); setSavingProduct(false); return; }
      toast.success('Service updated');
    } else {
      const { error } = await supabase.from('promotion_products').insert(payload);
      if (error) { toast.error('Failed to create'); setSavingProduct(false); return; }
      toast.success('Service created');
    }
    setSavingProduct(false);
    setProductModal(false);
    fetchProducts();
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'product') {
      await supabase.from('promotion_products').delete().eq('id', deleteTarget.id);
      toast.success('Service deleted');
      fetchProducts();
    } else {
      await supabase.from('promotion_orders').delete().eq('id', deleteTarget.id);
      toast.success('Order deleted');
      fetchOrders();
    }
    setDeleteTarget(null);
  };

  const openOrderModal = (order: Order) => {
    setViewingOrder(order);
    setOrderStartsFrom(order.starts_from || '');
    setOrderRejectionReason(order.rejection_reason || '');
    setOrderModal(true);
  };

  const updateOrderStatus = async (status: string) => {
    if (!viewingOrder) return;
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === 'approved') {
      update.starts_from = orderStartsFrom || null;
      update.rejection_reason = null;
    } else if (status === 'rejected') {
      if (!orderRejectionReason.trim()) { toast.error('Rejection reason required'); return; }
      update.rejection_reason = orderRejectionReason.trim();
      update.starts_from = null;
    }
    const { error } = await supabase.from('promotion_orders').update(update).eq('id', viewingOrder.id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success(`Order ${status}`);
    setOrderModal(false);
    fetchOrders();
  };

  const paginatedProducts = products.slice((productPage - 1) * pageSize, productPage * pageSize);
  const paginatedOrders = orders.slice((orderPage - 1) * pageSize, orderPage * pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Promotion Tools</h1>
          <div className="flex items-center gap-3">
            <Label htmlFor="promo-toggle" className="text-sm">Enable for Users</Label>
            <Switch id="promo-toggle" checked={isEnabled} onCheckedChange={toggleEnabled} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR Code */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Payment QR Code</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Payment QR" className="w-40 h-40 object-contain border rounded-lg bg-white p-2" />
              ) : (
                <div className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">No QR uploaded</div>
              )}
              <div className="space-y-2">
                <Label>Upload QR Code Image</Label>
                <Input type="file" accept="image/*" onChange={handleQrUpload} disabled={uploadingQr} />
                <p className="text-xs text-muted-foreground">This QR will be shown to users for payment</p>
              </div>
            </CardContent>
          </Card>

          {/* Tax Settings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Tax Settings</CardTitle>
              <Button size="sm" variant="outline" onClick={addTax}><Plus className="h-4 w-4 mr-1" /> Add Tax</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {taxes.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No taxes configured. Click "Add Tax" to add one.</p>
              )}
              {taxes.map((tax, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={tax.name} onChange={e => updateTax(i, 'name', e.target.value)} placeholder="Tax name (e.g. GST)" className="flex-1" />
                  <div className="flex items-center gap-1">
                    <Input type="number" min="0" max="100" step="0.01" value={tax.percent} onChange={e => updateTax(i, 'percent', e.target.value)} className="w-20" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeTax(i)}><X className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {taxes.length > 0 && (
                <Button size="sm" onClick={saveTaxes} className="w-full">Save Taxes</Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Services */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Services</CardTitle>
            <Button size="sm" onClick={() => openProductModal()}><Plus className="h-4 w-4 mr-1" /> Add Service</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Price per 1000 (₹)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No services yet</TableCell></TableRow>
                ) : paginatedProducts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><PlatformIcon platform={p.platform} size={24} /></TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>₹{p.price_per_unit}</TableCell>
                    <TableCell><StatusBadge status={p.is_active ? 'approved' : 'rejected'} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openProductModal(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'product', id: p.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {products.length > pageSize && (
              <TablePagination currentPage={productPage} onPageChange={setProductPage} pageSize={pageSize} onPageSizeChange={() => {}} totalItems={products.length} />
            )}
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader><CardTitle>Order History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Status</TableHead>
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
                      <div>
                        <span className="font-medium">{o.user_name}</span>
                        {o.user_display_id && <span className="text-xs text-muted-foreground ml-1">#{o.user_display_id}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={o.product_platform || ''} size={18} />
                        <span>{o.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{o.quantity}</TableCell>
                    <TableCell>₹{o.total_amount}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-sm">{format(new Date(o.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openOrderModal(o)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'order', id: o.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {orders.length > pageSize && (
              <TablePagination currentPage={orderPage} onPageChange={setOrderPage} pageSize={pageSize} onPageSizeChange={() => {}} totalItems={orders.length} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Modal */}
      <Dialog open={productModal} onOpenChange={setProductModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingProduct ? 'Edit Service' : 'Add Service'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select value={productPlatform} onValueChange={setProductPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon platform={p.value} size={18} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Instagram Followers" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="Brief description..." />
            </div>
            <div className="space-y-2">
              <Label>Price per 1000 Quantity (₹) *</Label>
              <Input type="number" min="0" step="0.01" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={productActive} onCheckedChange={setProductActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModal(false)}>Cancel</Button>
            <Button onClick={saveProduct} disabled={savingProduct}>{savingProduct ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <Dialog open={orderModal} onOpenChange={setOrderModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">User:</span> <span className="font-medium">{viewingOrder.user_name} #{viewingOrder.user_display_id}</span></div>
                <div className="flex items-center gap-1"><span className="text-muted-foreground">Service:</span> <PlatformIcon platform={viewingOrder.product_platform || ''} size={16} /> <span className="font-medium">{viewingOrder.product_name}</span></div>
                <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium">{viewingOrder.quantity}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">₹{viewingOrder.total_amount}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewingOrder.status} /></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{format(new Date(viewingOrder.created_at), 'dd MMM yyyy')}</span></div>
              </div>

              {viewingOrder.screenshot_url && (
                <div className="space-y-2">
                  <Label>Payment Screenshot</Label>
                  <img src={viewingOrder.screenshot_url} alt="Payment" className="max-w-full max-h-60 rounded-lg border object-contain" />
                </div>
              )}

              {viewingOrder.starts_from && (
                <div><span className="text-sm text-muted-foreground">Starts From:</span> <span className="font-medium">{viewingOrder.starts_from}</span></div>
              )}

              {viewingOrder.rejection_reason && (
                <div><span className="text-sm text-muted-foreground">Rejection Reason:</span> <span className="text-sm text-destructive">{viewingOrder.rejection_reason}</span></div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Starts From (for approved)</Label>
                  <Input value={orderStartsFrom} onChange={e => setOrderStartsFrom(e.target.value)} placeholder="e.g. 500" />
                </div>
                <div className="space-y-2">
                  <Label>Rejection Reason (for rejected)</Label>
                  <Textarea value={orderRejectionReason} onChange={e => setOrderRejectionReason(e.target.value)} placeholder="Reason..." />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setOrderModal(false)}>Close</Button>
            <Button variant="destructive" onClick={() => updateOrderStatus('rejected')}>Reject</Button>
            <Button onClick={() => updateOrderStatus('approved')}>Approve</Button>
            <Button variant="secondary" onClick={() => updateOrderStatus('pending')}>Set Pending</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <ConfirmDialog title="Delete" message="Are you sure you want to delete this item?" onConfirm={() => { deleteItem(); }} onCancel={() => setDeleteTarget(null)} />
      )}
    </DashboardLayout>
  );
}
