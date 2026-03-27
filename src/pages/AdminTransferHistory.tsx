import { DashboardLayout } from '@/components/DashboardLayout';
import { TransferHistory } from '@/components/TransferHistory';

const AdminTransferHistory = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Transfer History</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage all release ownership transfers
          </p>
        </div>
        <TransferHistory />
      </div>
    </DashboardLayout>
  );
};

export default AdminTransferHistory;
